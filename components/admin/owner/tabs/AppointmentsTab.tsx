'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, AppointmentStatus, Barber } from '@/types';
import { formatPrice, formatTime, getSession } from '@/lib/utils';

const STATUS_ORDER: AppointmentStatus[] = ['pending','confirmed','in_progress','done','cancelled'];

const STATUS_UI: Record<AppointmentStatus, { emoji: string; label: string; border: string; bg: string; color: string }> = {
  pending:     { emoji: '⏳', label: 'Pendiente',   border: 'rgba(241,196,15,0.4)',   bg: 'rgba(241,196,15,0.04)',   color: '#F1C40F' },
  confirmed:   { emoji: '✅', label: 'Confirmada',  border: 'rgba(46,204,113,0.4)',   bg: 'rgba(46,204,113,0.04)',   color: 'var(--green)' },
  in_progress: { emoji: '✂️', label: 'En atención', border: 'rgba(230,126,34,0.5)',   bg: 'rgba(230,126,34,0.06)',   color: '#E67E22' },
  done:        { emoji: '🏁', label: 'Atendido',    border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)', color: 'var(--gray)' },
  cancelled:   { emoji: '❌', label: 'Cancelado',   border: 'rgba(231,76,60,0.3)',    bg: 'rgba(231,76,60,0.04)',    color: '#E74C3C' },
};

const FILTER_LABELS: Record<AppointmentStatus | 'all', string> = {
  all:         '🗂️ Todas',
  pending:     '⏳ Pendientes',
  confirmed:   '✅ Confirmadas',
  in_progress: '✂️ En atención',
  done:        '🏁 Atendidas',
  cancelled:   '❌ Canceladas',
};

type SubTab = 'mine' | 'team';

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

function wspConfirmed(a: Appointment): string {
  return 'Hola ' + a.client_name + ', tu cita en Fresh Cuts ha sido *confirmada*.' + '%0A%0A' +
    'Fecha: ' + formatDateLong(a.appointment_date) + '%0A' +
    'Hora: ' + (a.appointment_time?.slice(0,5) || '') + ' hrs%0A' +
    'Servicio: ' + (a.service?.name || '') + '%0A%0A' +
    'Te esperamos! Si necesitas reagendar avisanos con anticipacion.';
}
function wspInProgress(a: Appointment): string {
  return 'Hola ' + a.client_name + '!%0A%0A' +
    'Estamos listos para atenderte. Te esperamos en Fresh Cuts.%0A' +
    'Hoy a las ' + (a.appointment_time?.slice(0,5) || '') + ' hrs.%0A%0ANos vemos pronto!';
}
function wspDone(a: Appointment): string {
  const precio = a.total_price ? '$' + Number(a.total_price).toLocaleString('es-CL') : '';
  return 'Hola ' + a.client_name + '!%0A%0A' +
    '*Comprobante de atencion - Fresh Cuts*%0A%0A' +
    'Servicio: ' + (a.service?.name || '') + '%0A' +
    'Barbero: ' + (a.barber?.name || '') + '%0A' +
    'Fecha: ' + formatDateLong(a.appointment_date) + '%0A' +
    'Hora: ' + (a.appointment_time?.slice(0,5) || '') + ' hrs%0A' +
    'Total pagado: ' + precio + '%0A%0A' +
    'Gracias por visitarnos, fue un placer atenderte!%0AFresh Cuts.';
}
function wspCancelled(a: Appointment): string {
  return 'Hola ' + a.client_name + ',%0A%0A' +
    'Tu cita del ' + formatDateLong(a.appointment_date) + ' a las ' + (a.appointment_time?.slice(0,5) || '') + ' hrs ha sido *cancelada*.%0A%0A' +
    'Puedes reservar una nueva hora cuando quieras en nuestro sitio web.%0ADisculpa los inconvenientes.';
}
const WSP_MESSAGES: Partial<Record<AppointmentStatus, (a: Appointment) => string>> = {
  confirmed: wspConfirmed, in_progress: wspInProgress, done: wspDone, cancelled: wspCancelled,
};

// ─── Tarjeta de cita reutilizable ───
function AppointmentCard({ a, canManage, onUpdate }: {
  a: Appointment;
  canManage: boolean;
  onUpdate?: (appt: Appointment, status: AppointmentStatus) => void;
}) {
  const ui = STATUS_UI[a.status];
  return (
    <div className="fc-card" style={{ padding: 0, overflow: 'hidden', border: `1px solid ${ui.border}`, background: ui.bg }}>
      <div style={{ height: 3, background: ui.color, opacity: 0.8 }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>👤 {a.client_name}</div>
            <div style={{ color: 'var(--gray)', fontSize: 12, marginTop: 3 }}>📞 {a.client_phone}</div>
            {a.barber && <div style={{ color: 'var(--gray)', fontSize: 12, marginTop: 2 }}>✂️ {a.barber.name}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="fc-title" style={{ fontSize: 24, color: 'var(--gold)', lineHeight: 1 }}>🕐 {formatTime(a.appointment_time)}</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20, background: `${ui.color}18`,
              border: `1px solid ${ui.border}`, fontSize: 10, fontWeight: 700, color: ui.color }}>
              {ui.emoji} {ui.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: a.notes ? 8 : (canManage ? 12 : 0) }}>
          <span style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold)', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>💈 {a.service?.name}</span>
          <span style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--gray)', padding: '4px 10px', borderRadius: 8, fontSize: 12 }}>💵 {formatPrice(a.total_price)}</span>
        </div>

        {a.notes && <div style={{ color: 'var(--gray)', fontSize: 12, marginBottom: canManage ? 12 : 0, fontStyle: 'italic' }}>📝 {a.notes}</div>}

        {/* Solo muestra botones si puede administrar */}
        {canManage && onUpdate && a.status !== 'done' && a.status !== 'cancelled' && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {a.status === 'pending' && (
              <button className="fc-btn-gold" style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => onUpdate(a, 'confirmed')}>✅ Confirmar</button>
            )}
            {(a.status === 'confirmed' || a.status === 'pending') && (
              <button style={{ padding: '8px 14px', fontSize: 12, background: '#E67E22', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => onUpdate(a, 'in_progress')}>✂️ Atendiendo</button>
            )}
            {a.status === 'in_progress' && (
              <button style={{ padding: '8px 14px', fontSize: 12, background: 'var(--green)', border: 'none', color: 'white', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }} onClick={() => onUpdate(a, 'done')}>🏁 Listo — enviar comprobante</button>
            )}
            <button style={{ padding: '8px 14px', fontSize: 12, background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: '#E74C3C', borderRadius: 8, cursor: 'pointer' }} onClick={() => onUpdate(a, 'cancelled')}>❌ Cancelar</button>
          </div>
        )}

        {canManage && onUpdate && a.status === 'done' && (
          <button style={{ padding: '7px 13px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--gray)', borderRadius: 8, cursor: 'pointer' }}
            onClick={() => { const w = formatChilePhone(a.client_phone); if (w) window.open('https://wa.me/' + w + '?text=' + wspDone(a), '_blank'); }}>
            📤 Reenviar comprobante
          </button>
        )}
      </div>
    </div>
  );
}

interface Props { isOwner?: boolean }

export default function AppointmentsTab({ isOwner = false }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('mine');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));
  const [filter, setFilter] = useState<AppointmentStatus | 'all'>('all');

  // Mis citas (del dueño o del barbero logueado)
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [myLoading, setMyLoading] = useState(true);

  // Citas del equipo (resto de barberos, solo para owner)
  const [teamAppointments, setTeamAppointments] = useState<Appointment[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<string>('all');

  const session = getSession();
  const dateRef = useRef(selectedDate);
  useEffect(() => { dateRef.current = selectedDate; }, [selectedDate]);

  // ─── Cargar mis citas ───
  const loadMyAppointments = useCallback(async () => {
    setMyLoading(true);
    const { data } = await supabase.from('appointments')
      .select('*, barber:barbers(*), service:services(*)')
      .eq('appointment_date', dateRef.current)
      .eq('barber_id', session?.barber_id)
      .order('appointment_time');
    if (data) setMyAppointments(data as Appointment[]);
    setMyLoading(false);
  }, [session?.barber_id]);

  // ─── Cargar citas del equipo (todos menos yo) ───
  const loadTeamAppointments = useCallback(async () => {
    if (!isOwner) return;
    setTeamLoading(true);
    const { data } = await supabase.from('appointments')
      .select('*, barber:barbers(*), service:services(*)')
      .eq('appointment_date', dateRef.current)
      .neq('barber_id', session?.barber_id)   // excluye al dueño
      .order('appointment_time');
    if (data) setTeamAppointments(data as Appointment[]);
    setTeamLoading(false);
  }, [isOwner, session?.barber_id]);

  // ─── Cargar lista de barberos para el filtro ───
  const loadBarbers = useCallback(async () => {
    if (!isOwner) return;
    const { data } = await supabase.from('barbers').select('*')
      .neq('id', session?.barber_id).eq('active', true).order('sort_order');
    if (data) setBarbers(data);
  }, [isOwner, session?.barber_id]);

  useEffect(() => {
    loadMyAppointments();
    loadTeamAppointments();
    loadBarbers();
  }, [selectedDate, loadMyAppointments, loadTeamAppointments, loadBarbers]);

  useEffect(() => {
    const channel = supabase.channel(`appt-owner-${session?.barber_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadMyAppointments();
        loadTeamAppointments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadMyAppointments, loadTeamAppointments]);

  async function updateStatus(appt: Appointment, status: AppointmentStatus) {
    await supabase.from('appointments').update({ status }).eq('id', appt.id);
    setMyAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status } : a));
    const waNum = formatChilePhone(appt.client_phone);
    const msgFn = WSP_MESSAGES[status];
    if (msgFn && waNum) window.open('https://wa.me/' + waNum + '?text=' + msgFn({ ...appt, status }), '_blank');
  }

  // ─── Filtrado ───
  const myFiltered = filter === 'all' ? myAppointments : myAppointments.filter(a => a.status === filter);
  const teamFiltered = (filter === 'all' ? teamAppointments : teamAppointments.filter(a => a.status === filter))
    .filter(a => selectedBarber === 'all' || a.barber_id === selectedBarber);

  const stats = [
    { emoji: '📋', label: 'Mis citas',   value: myAppointments.length,                                                        color: 'var(--gold)' },
    { emoji: '⏳', label: 'Pendientes',  value: myAppointments.filter(a => ['pending','confirmed'].includes(a.status)).length, color: '#F1C40F' },
    { emoji: '✂️', label: 'Atendiendo',  value: myAppointments.filter(a => a.status === 'in_progress').length,                color: '#E67E22' },
    { emoji: '🏁', label: 'Listos',      value: myAppointments.filter(a => a.status === 'done').length,                       color: 'var(--green)' },
  ];

  return (
    <div>
      {/* Header + selector de fecha */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 className="fc-title" style={{ fontSize: 24, color: 'var(--gold)' }}>📅 Citas</h2>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          className="fc-input" style={{ width: 'auto', fontSize: 13 }} />
      </div>

      {/* Sub-tabs solo para owner */}
      {isOwner && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 18 }}>
          {([
            { id: 'mine' as SubTab, label: '✂️ Mis citas' },
            { id: 'team' as SubTab, label: '👥 Equipo' },
          ]).map(t => (
            <button key={t.id} onClick={() => setSubTab(t.id)}
              style={{ flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                color: subTab === t.id ? 'var(--gold)' : 'var(--gray)',
                borderBottom: subTab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
                fontSize: 13, fontWeight: 600, transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════ MIS CITAS ══════════ */}
      {(!isOwner || subTab === 'mine') && (
        <div>
          {/* Stats */}
          {isOwner && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 18 }}>
              {stats.map(s => (
                <div key={s.label} className="fc-card" style={{ padding: '14px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{s.emoji}</div>
                  <div className="fc-title" style={{ fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, scrollbarWidth: 'none' }}>
            {(['all', ...STATUS_ORDER] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '6px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                  background: filter === s ? 'var(--gold)' : 'var(--card)', color: filter === s ? 'var(--black)' : 'var(--gray)' }}>
                {FILTER_LABELS[s]}
              </button>
            ))}
          </div>

          {myLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Cargando...</div>
          ) : myFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14 }}>No hay citas para esta fecha</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myFiltered.map(a => (
                <AppointmentCard key={a.id} a={a} canManage={true} onUpdate={updateStatus} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════ EQUIPO (solo owner) ══════════ */}
      {isOwner && subTab === 'team' && (
        <div>
          {/* Filtro por barbero */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, scrollbarWidth: 'none' }}>
            <button onClick={() => setSelectedBarber('all')}
              style={{ padding: '6px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                background: selectedBarber === 'all' ? 'var(--gold)' : 'var(--card)', color: selectedBarber === 'all' ? 'var(--black)' : 'var(--gray)' }}>
              👥 Todos
            </button>
            {barbers.map(b => (
              <button key={b.id} onClick={() => setSelectedBarber(b.id)}
                style={{ padding: '6px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                  background: selectedBarber === b.id ? 'var(--gold)' : 'var(--card)', color: selectedBarber === b.id ? 'var(--black)' : 'var(--gray)' }}>
                {b.avatar_emoji} {b.name}
              </button>
            ))}
          </div>

          {/* Filtros por estado */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 4, scrollbarWidth: 'none' }}>
            {(['all', ...STATUS_ORDER] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ padding: '6px 13px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0, fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
                  background: filter === s ? 'var(--gold)' : 'var(--card)', color: filter === s ? 'var(--black)' : 'var(--gray)' }}>
                {FILTER_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Resumen del equipo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { emoji: '📋', label: 'Total equipo', value: teamAppointments.length, color: 'var(--cream)' },
              { emoji: '⏳', label: 'Pendientes',   value: teamAppointments.filter(a => ['pending','confirmed'].includes(a.status)).length, color: '#F1C40F' },
              { emoji: '🏁', label: 'Atendidos',    value: teamAppointments.filter(a => a.status === 'done').length, color: 'var(--green)' },
            ].map(s => (
              <div key={s.label} className="fc-card" style={{ padding: '14px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 18, marginBottom: 2 }}>{s.emoji}</div>
                <div className="fc-title" style={{ fontSize: 22, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'var(--gray)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {teamLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}><div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>Cargando...</div>
          ) : teamFiltered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--gray)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 14 }}>No hay citas del equipo para esta fecha</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {teamFiltered.map(a => (
                // canManage=false → solo lectura, sin botones de acción
                <AppointmentCard key={a.id} a={a} canManage={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
