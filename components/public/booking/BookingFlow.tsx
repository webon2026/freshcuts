'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Barber, Service } from '@/types';
import { formatPrice } from '@/lib/utils';

type Step = 'service' | 'barber' | 'datetime' | 'info' | 'confirm' | 'success';

interface BookingData {
  service?: Service; barber?: Barber; date?: string;
  time?: string; client_name?: string; client_phone?: string; notes?: string;
}

// Cada slot tiene un estado visual
type SlotState = 'free' | 'pending' | 'taken';
interface Slot { time: string; state: SlotState; }

const BARBER_COLOR: Record<string, string> = {
  available: 'var(--green)', busy: '#E67E22', break: '#F1C40F', off: '#E74C3C',
};
const BARBER_LABEL: Record<string, string> = {
  available: 'Disponible', busy: 'En atencion', break: 'Descanso', off: 'No disponible',
};

export default function BookingFlow() {
  const [step, setStep] = useState<Step>('service');
  const [bdata, setBdata] = useState<BookingData>({});
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [pendingMsg, setPendingMsg] = useState(''); // mensaje al tocar slot pendiente
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [days, setDays] = useState<{ iso: string; label: string; num: number }[]>([]);

  const barberIdRef = useRef<string>('');
  const dayRef = useRef<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadServices();
    loadSettings();
    buildDays();
  }, []);

  function buildDays() {
    const today = new Date();
    const names = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
    setDays(Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i);
      return { iso: d.toISOString().slice(0,10), label: i===0?'Hoy':i===1?'Manana':names[d.getDay()], num: d.getDate() };
    }));
  }

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('key,value');
    if (data) { const m: Record<string,string> = {}; data.forEach(s => { m[s.key]=s.value; }); setSettings(m); }
  }

  async function loadServices() {
    const { data } = await supabase.from('services').select('*').eq('active',true).order('sort_order');
    if (data) setServices(data);
  }

  async function loadBarbers() {
    const { data } = await supabase.from('barbers').select('*').eq('active',true).order('sort_order');
    if (data) setBarbers(data);
  }

  // ─── Cargar slots directo desde Supabase (sin API route, sin caché) ───
  async function loadSlots(barberId: string, date: string, showSpinner = true) {
    if (showSpinner) setLoadingSlots(true);
    setSlotError('');
    try {
      // 1. Estado del barbero
      const { data: barber } = await supabase
        .from('barbers').select('status').eq('id', barberId).single();

      if (!barber || barber.status === 'off') {
        setSlotError('Este barbero no esta disponible. Elige otro.');
        setSlots([]);
        if (showSpinner) setLoadingSlots(false);
        return;
      }
      if (barber.status === 'break') {
        setSlotError('Este barbero esta en descanso. Intenta mas tarde.');
        setSlots([]);
        if (showSpinner) setLoadingSlots(false);
        return;
      }

      // 2. Fecha pasada — usar hora Chile (UTC-3)
      const nowChile = new Date(Date.now() - 3 * 3600000);
      const todayISO = nowChile.toISOString().slice(0, 10);
      if (date < todayISO) {
        setSlotError('No puedes reservar en una fecha pasada.');
        setSlots([]);
        if (showSpinner) setLoadingSlots(false);
        return;
      }

      // 3. Generar todos los slots del día (09:00 - 19:30, cada 30 min)
      const isToday = date === todayISO;
      const chileMinutes = nowChile.getUTCHours() * 60 + nowChile.getUTCMinutes();
      const allTimes: string[] = [];
      for (let h = 9; h < 20; h++) {
        for (const m of [0, 30]) {
          if (isToday && (h * 60 + m) <= chileMinutes + 30) continue;
          allTimes.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
        }
      }

      // 4. Bloqueos del barbero ese día
      const { data: blocks } = await supabase
        .from('barber_blocks').select('*')
        .eq('barber_id', barberId).eq('block_date', date);

      const blockedSet = new Set<string>();
      for (const b of blocks || []) {
        if (!b.start_time || !b.end_time) {
          allTimes.forEach(t => blockedSet.add(t));
        } else {
          const bs = toMin(b.start_time), be = toMin(b.end_time);
          allTimes.forEach(t => { if (toMin(t) >= bs && toMin(t) < be) blockedSet.add(t); });
        }
      }

      // 5. Citas existentes — separar pending de confirmed/in_progress
      const { data: appts } = await supabase
        .from('appointments').select('appointment_time, status')
        .eq('barber_id', barberId)
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed', 'in_progress']);

      const pendingSet = new Set<string>();
      const takenSet = new Set<string>();
      for (const a of appts || []) {
        const t = a.appointment_time.slice(0, 5);
        if (a.status === 'pending') pendingSet.add(t);
        else takenSet.add(t); // confirmed o in_progress
      }

      // 6. Construir slots visibles: excluir bloqueados y tomados, mostrar pending con aviso
      const result: Slot[] = allTimes
        .filter(t => !blockedSet.has(t) && !takenSet.has(t))
        .map(t => ({ time: t, state: pendingSet.has(t) ? 'pending' : 'free' }));

      setSlots(result);
    } catch {
      setSlotError('Error cargando horarios. Intenta de nuevo.');
    }
    if (showSpinner) setLoadingSlots(false);
  }

  function toMin(t: string): number {
    const [h, m] = t.slice(0, 5).split(':').map(Number);
    return h * 60 + m;
  }

  // ─── Polling cada 4s mientras el usuario está eligiendo hora ───
  function startPolling(barberId: string, date: string) {
    stopPolling();
    pollRef.current = setInterval(() => {
      loadSlots(barberId, date, false); // sin spinner para no parpadear
    }, 4000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  // Iniciar/detener polling según el step
  useEffect(() => {
    if (step === 'datetime' && barberIdRef.current && dayRef.current) {
      startPolling(barberIdRef.current, dayRef.current);
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [step]);

  // Realtime como capa adicional (si funciona, actualiza más rápido que el polling)
  useEffect(() => {
    const ch = supabase.channel('bf-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        if (barberIdRef.current && dayRef.current) {
          loadSlots(barberIdRef.current, dayRef.current, false);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'barbers' }, () => {
        if (barberIdRef.current && dayRef.current) {
          loadSlots(barberIdRef.current, dayRef.current, false);
        }
      })
      .subscribe((status: string) => {
        // Si el realtime falla, el polling de 4s igual cubre
        if (status === 'CHANNEL_ERROR') console.warn('[RT] sin realtime, usando polling');
      });
    return () => { supabase.removeChannel(ch); };
  }, []);

  function handleSelectDay(iso: string) {
    setSelectedDay(iso);
    dayRef.current = iso;
    setSlots([]);
    setPendingMsg('');
    setBdata(d => ({ ...d, date: iso, time: undefined }));
    if (barberIdRef.current) loadSlots(barberIdRef.current, iso, true);
  }

  function handleClickSlot(slot: Slot) {
    if (slot.state === 'pending') {
      setPendingMsg('Las ' + slot.time + ' hrs las esta tomando otro cliente en este momento. Intenta mas tarde o elige otra hora.');
      setTimeout(() => setPendingMsg(''), 5000);
      return;
    }
    setPendingMsg('');
    setBdata(d => ({ ...d, time: slot.time }));
    setStep('info');
  }

  async function submitBooking() {
    if (!bdata.service || !bdata.barber || !bdata.date || !bdata.time || !bdata.client_name || !bdata.client_phone) return;
    setLoading(true);

    // Verificar que el slot sigue libre directamente en Supabase
    const { data: conflict } = await supabase
      .from('appointments').select('id')
      .eq('barber_id', bdata.barber.id)
      .eq('appointment_date', bdata.date)
      .eq('appointment_time', bdata.time + ':00')
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .limit(1);

    if (conflict && conflict.length > 0) {
      setLoading(false);
      alert('Esa hora ya no esta disponible. Por favor elige otra.');
      loadSlots(bdata.barber.id, bdata.date, true);
      setStep('datetime');
      return;
    }

    const { error } = await supabase.from('appointments').insert({
      barber_id: bdata.barber.id,
      service_id: bdata.service.id,
      client_name: bdata.client_name.trim(),
      client_phone: bdata.client_phone.trim(),
      appointment_date: bdata.date,
      appointment_time: bdata.time + ':00',
      status: 'pending',
      notes: bdata.notes || '',
      total_price: bdata.service.price,
    });

    setLoading(false);
    if (!error) {
      // Actualizar slot localmente a 'pending' para quien siga viendo la pantalla
      setSlots(prev => prev.map(s => s.time === bdata.time ? { ...s, state: 'pending' } : s));

      const rawPhone = bdata.barber.phone || settings.whatsapp_number || '';
      const waNum = formatChilePhone(rawPhone);
      if (waNum) {
        const precio = bdata.service.price ? '$' + Number(bdata.service.price).toLocaleString('es-CL') : '';
        const texto =
          '*Nueva cita - Fresh Cuts*' + '%0A' +
          '%0A' +
          'Cliente: ' + bdata.client_name + '%0A' +
          'Telefono: ' + bdata.client_phone + '%0A' +
          'Servicio: ' + bdata.service.name + '%0A' +
          'Fecha: ' + formatDateLong(bdata.date) + '%0A' +
          'Hora: ' + bdata.time + ' hrs' + '%0A' +
          'Total: ' + precio +
          (bdata.notes ? '%0ANotas: ' + bdata.notes : '');
        window.open('https://wa.me/' + waNum + '?text=' + texto, '_blank');
      }
      setStep('success');
    } else {
      alert('Error al reservar, intenta de nuevo.');
    }
  }

  function formatChilePhone(raw: string): string {
    const d = raw.replace(/\D/g, '');
    if (!d) return '';
    if (d.startsWith('569')) return d;
    if (d.startsWith('56')) return d;
    if (d.startsWith('9') && d.length === 9) return '56' + d;
    if (d.length === 8) return '569' + d;
    return d;
  }

  function formatDateLong(dateStr?: string) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const stepBar = ['service','barber','datetime','info','confirm'];
  const stepIdx = stepBar.indexOf(step);

  if (step === 'success') return (
    <div className="anim-fadeup" style={{ textAlign: 'center', padding: '40px 16px' }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
      <div className="fc-title" style={{ fontSize: 30, color: 'var(--gold)', marginBottom: 10 }}>CITA RESERVADA</div>
      <p style={{ color: 'var(--gray)', marginBottom: 4 }}>Te esperamos el <strong style={{ color: 'var(--cream)' }}>{formatDateLong(bdata.date)}</strong></p>
      <p style={{ color: 'var(--gray)', marginBottom: 4 }}>a las <strong style={{ color: 'var(--gold)', fontSize: 22 }}>{bdata.time}</strong></p>
      <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 32 }}>con {bdata.barber?.name} · {bdata.service?.name}</p>
      <button className="fc-btn-gold" onClick={() => { setStep('service'); setBdata({}); setSelectedDay(null); setSlots([]); }}>
        Reservar otra hora
      </button>
    </div>
  );

  return (
    <div>
      {/* Progreso */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
          {stepBar.map((s, i) => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= stepIdx ? 'var(--gold)' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
          ))}
        </div>
        <div className="fc-label" style={{ fontSize: 10, color: 'var(--gray)' }}>Paso {stepIdx+1} de {stepBar.length}</div>
      </div>

      {/* STEP 1 — SERVICIO */}
      {step === 'service' && (
        <div className="anim-fadeup">
          <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 4 }}>Que servicio?</h2>
          <p style={{ color: 'var(--gray)', marginBottom: 16, fontSize: 13 }}>Elige el servicio que necesitas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {services.map(s => (
              <button key={s.id}
                onClick={() => { setBdata({ ...bdata, service: s }); setStep('barber'); loadBarbers(); }}
                style={{ background: 'var(--card)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'}
              >
                <div>
                  <div style={{ color: 'var(--cream)', fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  {s.description && <div style={{ color: 'var(--gray)', fontSize: 12, marginTop: 2 }}>{s.description}</div>}
                  <div style={{ color: 'var(--gray)', fontSize: 11, marginTop: 3 }}>Duracion: {s.duration_minutes} min</div>
                </div>
                <div className="fc-title" style={{ fontSize: 22, color: 'var(--gold)', flexShrink: 0, marginLeft: 12 }}>{formatPrice(s.price)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2 — BARBERO */}
      {step === 'barber' && (
        <div className="anim-fadeup">
          <button onClick={() => setStep('service')} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontSize: 13 }}>← Volver</button>
          <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 4 }}>Con quien?</h2>
          <p style={{ color: 'var(--gray)', marginBottom: 16, fontSize: 13 }}>Elige tu barbero</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {barbers.map(b => {
              const isOff = b.status === 'off';
              return (
                <button key={b.id}
                  onClick={() => {
                    if (isOff) return;
                    barberIdRef.current = b.id;
                    setBdata({ ...bdata, barber: b });
                    setStep('datetime');
                  }}
                  disabled={isOff}
                  style={{ background: 'var(--card)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 18px', cursor: isOff ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 14, opacity: isOff ? 0.4 : 1, width: '100%', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => { if (!isOff) e.currentTarget.style.borderColor = 'var(--gold)'; }}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.2)'}
                >
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{b.avatar_emoji}</div>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ color: 'var(--cream)', fontWeight: 600, fontSize: 15 }}>
                      {b.name}
                      {b.role === 'owner' && <span style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(201,168,76,0.1)', padding: '2px 7px', borderRadius: 8, marginLeft: 6 }}>Dueno</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: BARBER_COLOR[b.status] || 'var(--gray)', flexShrink: 0 }} />
                      <span style={{ color: 'var(--gray)', fontSize: 12 }}>{BARBER_LABEL[b.status] || b.status}</span>
                    </div>
                  </div>
                  {isOff && <span style={{ fontSize: 11, color: '#E74C3C', background: 'rgba(231,76,60,0.1)', padding: '3px 8px', borderRadius: 8, flexShrink: 0 }}>No disponible</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3 — FECHA Y HORA */}
      {step === 'datetime' && (
        <div className="anim-fadeup">
          <button onClick={() => { stopPolling(); setStep('barber'); }} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontSize: 13 }}>← Volver</button>
          <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 4 }}>Cuando?</h2>
          <p style={{ color: 'var(--gray)', marginBottom: 16, fontSize: 13 }}>con {bdata.barber?.name} · {bdata.service?.name}</p>

          {/* Días */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6, marginBottom: 18, scrollbarWidth: 'none' }}>
            {days.map(d => {
              const sel = selectedDay === d.iso;
              return (
                <button key={d.iso} onClick={() => handleSelectDay(d.iso)}
                  style={{ minWidth: 56, padding: '9px 6px', borderRadius: 10, border: `1px solid ${sel ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', textAlign: 'center', background: sel ? 'var(--gold)' : 'var(--card)', color: sel ? 'var(--black)' : 'var(--gray)', transition: 'all 0.15s', flexShrink: 0 }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{d.num}</div>
                </button>
              );
            })}
          </div>

          {/* Error de barbero */}
          {slotError && (
            <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 10, padding: '16px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ color: '#E74C3C', fontSize: 13, marginBottom: 10 }}>{slotError}</div>
              <button onClick={() => setStep('barber')} style={{ padding: '7px 18px', fontSize: 12, background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--gray)', borderRadius: 8, cursor: 'pointer' }}>
                Elegir otro barbero
              </button>
            </div>
          )}

          {/* Aviso slot pendiente */}
          {pendingMsg && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(241,196,15,0.07)', border: '1px solid rgba(241,196,15,0.25)', borderRadius: 10 }}>
              <div style={{ color: '#F1C40F', fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Hora en proceso de reserva</div>
              <div style={{ color: 'var(--gray)', fontSize: 12 }}>{pendingMsg}</div>
            </div>
          )}

          {/* Grilla de slots */}
          {selectedDay && !slotError && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="fc-label" style={{ fontSize: 10, color: 'var(--gray)' }}>Horarios disponibles</div>
                {loadingSlots && <div style={{ fontSize: 11, color: 'var(--gold)' }}>cargando...</div>}
              </div>

              {!loadingSlots && slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray)' }}>
                  No hay horarios disponibles este dia
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {slots.map(slot => {
                      const isPending = slot.state === 'pending';
                      return (
                        <button key={slot.time}
                          onClick={() => handleClickSlot(slot)}
                          style={{
                            padding: isPending ? '7px 0 5px' : '11px 0',
                            borderRadius: 8,
                            border: isPending ? '1px solid rgba(241,196,15,0.4)' : '1px solid rgba(201,168,76,0.2)',
                            background: isPending ? 'rgba(241,196,15,0.07)' : 'var(--card)',
                            color: isPending ? 'rgba(241,196,15,0.55)' : 'var(--cream)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isPending) { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--black)'; }
                            else { e.currentTarget.style.background = 'rgba(241,196,15,0.12)'; }
                          }}
                          onMouseLeave={e => {
                            if (!isPending) { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--cream)'; }
                            else { e.currentTarget.style.background = 'rgba(241,196,15,0.07)'; }
                          }}
                        >
                          <div>{slot.time}</div>
                          {isPending && <div style={{ fontSize: 9, color: 'rgba(241,196,15,0.55)', marginTop: 2 }}>En proceso</div>}
                        </button>
                      );
                    })}
                  </div>

                  {slots.some(s => s.state === 'pending') && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: 'var(--gray)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--card)', border: '1px solid rgba(201,168,76,0.3)' }} />
                        Disponible
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.4)' }} />
                        En proceso
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — DATOS */}
      {step === 'info' && (
        <div className="anim-fadeup">
          <button onClick={() => setStep('datetime')} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontSize: 13 }}>← Volver</button>
          <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 4 }}>Tus datos</h2>
          <p style={{ color: 'var(--gray)', marginBottom: 20, fontSize: 13 }}>Para confirmar tu cita</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Nombre completo</label>
              <input className="fc-input" placeholder="Tu nombre" value={bdata.client_name || ''} onChange={e => setBdata(d => ({...d, client_name: e.target.value}))} />
            </div>
            <div>
              <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Telefono WhatsApp</label>
              <input className="fc-input" placeholder="+56 9 1234 5678" type="tel" value={bdata.client_phone || ''} onChange={e => setBdata(d => ({...d, client_phone: e.target.value}))} />
            </div>
            <div>
              <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Nota opcional</label>
              <input className="fc-input" placeholder="Ej: corte con referencia" value={bdata.notes || ''} onChange={e => setBdata(d => ({...d, notes: e.target.value}))} />
            </div>
            <button className="fc-btn-gold" disabled={!bdata.client_name || !bdata.client_phone} onClick={() => setStep('confirm')} style={{ marginTop: 6 }}>
              Revisar reserva →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5 — CONFIRMAR */}
      {step === 'confirm' && (
        <div className="anim-fadeup">
          <button onClick={() => setStep('info')} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontSize: 13 }}>← Volver</button>
          <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 18 }}>Confirmar cita</h2>
          <div className="fc-card" style={{ padding: 20, marginBottom: 16 }}>
            {([
              ['💈', 'Servicio',  bdata.service?.name],
              ['💵', 'Precio',    bdata.service ? formatPrice(bdata.service.price) : ''],
              ['✂️', 'Barbero',   bdata.barber?.name],
              ['📅', 'Fecha',     formatDateLong(bdata.date)],
              ['🕐', 'Hora',      bdata.time ? bdata.time + ' hrs' : ''],
              ['👤', 'Cliente',   bdata.client_name],
              ['📞', 'Teléfono',  bdata.client_phone],
              ...(bdata.notes ? [['📝', 'Nota', bdata.notes]] : []),
            ] as [string, string, string][]).map(([emoji, label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: 12 }}>
                <span style={{ color: 'var(--gray)', fontSize: 13, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{emoji}</span>{label}
                </span>
                <span style={{ color: 'var(--cream)', fontWeight: 600, fontSize: 13, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          <button className="fc-btn-gold" style={{ width: '100%', padding: 15, fontSize: 15 }} disabled={loading} onClick={submitBooking}>
            {loading ? 'Reservando...' : 'Confirmar reserva'}
          </button>
        </div>
      )}
    </div>
  );
}
