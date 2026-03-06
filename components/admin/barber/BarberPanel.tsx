'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminSession, Appointment, Barber, AppointmentStatus } from '@/types';
import { STATUS_LABELS, BARBER_STATUS_LABELS, formatPrice, formatTime } from '@/lib/utils';
import BlockSchedule from '@/components/admin/shared/BlockSchedule';

interface Props { session: AdminSession; onLogout: () => void; }

type Tab = 'appointments' | 'blocks';

const STATUS_OPTIONS: { value: Barber['status']; label: string; emoji: string; color: string }[] = [
  { value: 'available', label: 'Disponible',    emoji: '✅', color: 'var(--green)' },
  { value: 'busy',      label: 'En atención',   emoji: '✂️', color: '#E67E22' },
  { value: 'break',     label: 'Descanso',      emoji: '☕', color: '#F1C40F' },
  { value: 'off',       label: 'No disponible', emoji: '🔴', color: '#E74C3C' },
];

const STATUS_UI: Record<AppointmentStatus, { emoji: string; label: string; border: string; bg: string; color: string }> = {
  pending:     { emoji: '⏳', label: 'Pendiente',   border: 'rgba(241,196,15,0.4)',   bg: 'rgba(241,196,15,0.04)',   color: '#F1C40F' },
  confirmed:   { emoji: '✅', label: 'Confirmada',  border: 'rgba(46,204,113,0.4)',   bg: 'rgba(46,204,113,0.04)',   color: 'var(--green)' },
  in_progress: { emoji: '✂️', label: 'En atención', border: 'rgba(230,126,34,0.5)',   bg: 'rgba(230,126,34,0.06)',   color: '#E67E22' },
  done:        { emoji: '🏁', label: 'Atendido',    border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)', color: 'var(--gray)' },
  cancelled:   { emoji: '❌', label: 'Cancelado',   border: 'rgba(231,76,60,0.3)',    bg: 'rgba(231,76,60,0.04)',    color: '#E74C3C' },
};

function formatChilePhone(raw?: string): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.startsWith('569')) return d;
  if (d.startsWith('56'))  return d;
  if (d.startsWith('9') && d.length === 9) return '56' + d;
  if (d.length === 8) return '569' + d;
  return d;
}
function formatDateLong(dateStr?: string) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ─── Mensajes WSP por estado ───
function wspConfirmed(a: Appointment): string {
  return 'Hola ' + a.client_name + ', tu cita en Fresh Cuts ha sido *confirmada*.' + '%0A' + '%0A' +
    'Fecha: ' + formatDateLong(a.appointment_date) + '%0A' +
    'Hora: ' + (a.appointment_time?.slice(0,5) || '') + ' hrs' + '%0A' +
    'Servicio: ' + (a.service?.name || '') + '%0A' + '%0A' +
    'Te esperamos! Si necesitas reagendar avisanos con anticipacion.';
}
function wspInProgress(a: Appointment): string {
  return 'Hola ' + a.client_name + '!' + '%0A' + '%0A' +
    'Estamos listos para atenderte. Te esperamos en Fresh Cuts.' + '%0A' +
    'Hoy a las ' + (a.appointment_time?.slice(0,5) || '') + ' hrs.' + '%0A' + '%0A' + 'Nos vemos pronto!';
}
function wspDone(a: Appointment): string {
  const precio = a.total_price ? '$' + Number(a.total_price).toLocaleString('es-CL') : '';
  return 'Hola ' + a.client_name + '!' + '%0A' + '%0A' +
    '*Comprobante de atencion - Fresh Cuts*' + '%0A' + '%0A' +
    'Servicio: ' + (a.service?.name || '') + '%0A' +
    'Fecha: ' + formatDateLong(a.appointment_date) + '%0A' +
    'Hora: ' + (a.appointment_time?.slice(0,5) || '') + ' hrs' + '%0A' +
    'Total pagado: ' + precio + '%0A' + '%0A' +
    'Gracias por visitarnos, fue un placer atenderte!' + '%0A' + 'Te esperamos pronto en Fresh Cuts.';
}
function wspCancelled(a: Appointment): string {
  return 'Hola ' + a.client_name + ',' + '%0A' + '%0A' +
    'Tu cita del ' + formatDateLong(a.appointment_date) + ' a las ' + (a.appointment_time?.slice(0,5) || '') + ' hrs ha sido *cancelada*.' + '%0A' + '%0A' +
    'Puedes reservar una nueva hora cuando quieras en nuestro sitio web.' + '%0A' + 'Disculpa los inconvenientes.';
}

const WSP_MESSAGES: Partial<Record<AppointmentStatus, (a: Appointment) => string>> = {
  confirmed: wspConfirmed, in_progress: wspInProgress, done: wspDone, cancelled: wspCancelled,
};

export default function BarberPanel({ session, onLogout }: Props) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [tab, setTab] = useState<Tab>('appointments');
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const dateRef = useRef(date);
  useEffect(() => { dateRef.current = date; }, [date]);

  async function loadBarber() {
    const { data } = await supabase.from('barbers').select('*').eq('id', session.barber_id).single();
    if (data) setBarber(data);
  }

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('appointments').select('*, service:services(*)')
      .eq('barber_id', session.barber_id).eq('appointment_date', dateRef.current).order('appointment_time');
    if (data) setAppointments(data as Appointment[]);
    setLoading(false);
  }, [session.barber_id]);

  useEffect(() => { loadBarber(); }, []);
  useEffect(() => { loadAppointments(); }, [date, loadAppointments]);

  useEffect(() => {
    const channel = supabase.channel(`barber-panel-${session.barber_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => loadAppointments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAppointments]);

  async function updateStatus(appt: Appointment, status: AppointmentStatus) {
    await supabase.from('appointments').update({ status }).eq('id', appt.id);
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status } : a));
    const waNum = formatChilePhone(appt.client_phone);
    const msgFn = WSP_MESSAGES[status];
    if (msgFn && waNum) window.open('https://wa.me/' + waNum + '?text=' + msgFn({ ...appt, status }), '_blank');
  }

  async function setMyStatus(status: Barber['status']) {
    await supabase.from('barbers').update({ status }).eq('id', session.barber_id);
    setBarber(b => b ? { ...b, status } : b);
    setShowStatusPicker(false);
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === barber?.status);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'var(--dark)', borderBottom: '1px solid rgba(201,168,76,0.2)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.jpg" alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }} />
          <div>
            <div className="fc-title" style={{ fontSize: 16, color: 'var(--gold)', lineHeight: 1 }}>FRESH CUTS</div>
            <div className="fc-label" style={{ fontSize: 9, color: 'var(--gray)', letterSpacing: 2 }}>✂️ {session.name}</div>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowStatusPicker(!showStatusPicker)}
            style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${currentStatus?.color || 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{currentStatus?.emoji || '⚪'}</span>
            <span className="fc-label" style={{ fontSize: 10, color: currentStatus?.color || 'var(--gray)', letterSpacing: 1 }}>{currentStatus?.label || 'Estado'}</span>
            <span style={{ color: 'var(--gray)', fontSize: 10 }}>▾</span>
          </button>

          {showStatusPicker && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: '#1e1e1e', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: 8, zIndex: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.5)', minWidth: 190 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setMyStatus(s.value)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: barber?.status === s.value ? 'rgba(201,168,76,0.08)' : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                  <span style={{ fontSize: 16 }}>{s.emoji}</span>
                  <span style={{ color: s.color, fontSize: 13, fontWeight: 600, flex: 1, textAlign: 'left' }}>{s.label}</span>
                  {barber?.status === s.value && <span style={{ color: 'var(--gold)', fontSize: 12 }}>✓</span>}
                </button>
              ))}
              {barber?.status === 'off' && (
                <div style={{ margin: '6px 12px 4px', padding: 8, background: 'rgba(231,76,60,0.08)', borderRadius: 8, fontSize: 11, color: '#E74C3C', lineHeight: 1.4 }}>
                  ⚠️ Estás como No disponible. Los clientes no pueden reservar contigo.
                </div>
              )}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 0' }} />
              <button onClick={onLogout} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: 8 }}>
                🚪 Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {showStatusPicker && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowStatusPicker(false)} />}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--dark)', position: 'sticky', top: 58, zIndex: 40 }}>
        {([
          { id: 'appointments', label: '📅 Mis citas' },
          { id: 'blocks',       label: '⏰ Mis horarios' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer', color: tab === t.id ? 'var(--gold)' : 'var(--gray)', borderBottom: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent', fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>

        {/* TAB CITAS */}
        {tab === 'appointments' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className="fc-title" style={{ fontSize: 22, color: 'var(--gold)' }}>📅 Mis citas</h2>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="fc-input" style={{ width: 'auto', fontSize: 13 }} />
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Cargando citas...
              </div>
            ) : appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>😊</div>
                No tienes citas este día
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {appointments.map(a => {
                  const ui = STATUS_UI[a.status];
                  return (
                    <div key={a.id} className="fc-card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${ui.border}`, background: ui.bg }}>
                      <div style={{ height: 3, background: ui.color, opacity: 0.8 }} />
                      <div style={{ padding: '14px 16px' }}>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>👤 {a.client_name}</div>
                            <div style={{ color: 'var(--gray)', fontSize: 12, marginTop: 2 }}>📞 {a.client_phone}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="fc-title" style={{ fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>🕐 {formatTime(a.appointment_time)}</div>
                            <div style={{ marginTop: 5, display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '3px 10px', borderRadius: 20, background: `${ui.color}18`,
                              border: `1px solid ${ui.border}`, fontSize: 10, fontWeight: 700, color: ui.color }}>
                              {ui.emoji} {ui.label}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: a.notes ? 8 : 12 }}>
                          <span style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>💈 {a.service?.name}</span>
                          <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gray)', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>💵 {formatPrice(a.total_price)}</span>
                        </div>

                        {a.notes && <div style={{ color: 'var(--gray)', fontSize: 12, marginBottom: 12, fontStyle: 'italic' }}>📝 {a.notes}</div>}

                        {a.status !== 'done' && a.status !== 'cancelled' && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {a.status === 'pending' && (
                              <button className="fc-btn-gold" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => updateStatus(a, 'confirmed')}>✅ Confirmar</button>
                            )}
                            {(a.status === 'confirmed' || a.status === 'pending') && (
                              <button style={{ padding: '8px 14px', fontSize: 12, background: '#E67E22', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => updateStatus(a, 'in_progress')}>✂️ Atendiendo</button>
                            )}
                            {a.status === 'in_progress' && (
                              <button style={{ padding: '8px 14px', fontSize: 12, background: 'var(--green)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => updateStatus(a, 'done')}>🏁 Listo — enviar comprobante</button>
                            )}
                            <button style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#E74C3C', borderRadius: 8, cursor: 'pointer' }} onClick={() => updateStatus(a, 'cancelled')}>❌ Cancelar</button>
                          </div>
                        )}

                        {a.status === 'done' && (
                          <button style={{ padding: '7px 13px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gray)', borderRadius: 8, cursor: 'pointer' }}
                            onClick={() => { const w = formatChilePhone(a.client_phone); if (w) window.open('https://wa.me/' + w + '?text=' + wspDone(a), '_blank'); }}>
                            📤 Reenviar comprobante
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB BLOQUEOS */}
        {tab === 'blocks' && barber && (
          <div>
            <h2 className="fc-title" style={{ fontSize: 22, color: 'var(--gold)', marginBottom: 6 }}>⏰ Mis horarios</h2>
            <p style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 20 }}>
              Bloquea horas para descansos, almuerzo u otras actividades. Los clientes no podrán reservar esos horarios.
            </p>
            {barber.status === 'off' && (
              <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: '#E74C3C', fontSize: 14, marginBottom: 4 }}>🔴 Estás como No disponible</div>
                <div style={{ color: 'var(--gray)', fontSize: 12, marginBottom: 10 }}>Los clientes no pueden reservar contigo. Cambia tu estado cuando estés listo.</div>
                <button className="fc-btn-gold" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => setMyStatus('available')}>✅ Marcarme como disponible</button>
              </div>
            )}
            <div className="fc-card" style={{ padding: 16 }}>
              <BlockSchedule barberId={barber.id} barberName={barber.name} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
