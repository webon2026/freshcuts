'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Block {
  id: string;
  barber_id: string;
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  auto_expires: boolean;
  created_at: string;
}

interface Props {
  barberId: string;
  barberName: string;
}

type BlockType = 'range' | 'duration' | 'allday';

const REASONS_TIMED = [
  { value: 'break',    label: '☕ Descanso' },
  { value: 'lunch',    label: '🍽️ Almuerzo' },
  { value: 'personal', label: '🏠 Personal' },
  { value: 'medical',  label: '🏥 Médico' },
  { value: 'other',    label: '📝 Otro' },
];

const REASONS_ALLDAY = [
  { value: 'break',    label: '☕ Descanso' },
  { value: 'personal', label: '🏠 Personal' },
  { value: 'medical',  label: '🏥 Médico' },
  { value: 'vacation', label: '🌴 Vacaciones' },
  { value: 'other',    label: '📝 Otro' },
];

const ALL_REASONS = [
  ...REASONS_TIMED,
  { value: 'vacation', label: '🌴 Vacaciones' },
];

const TIME_SLOTS: string[] = [];
for (let h = 9; h < 20; h++) {
  for (const m of [0, 30]) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export default function BlockSchedule({ barberId, barberName }: Props) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [blockType, setBlockType] = useState<BlockType>('range');
  const [form, setForm] = useState({
    block_date: new Date().toISOString().slice(0, 10),
    start_time: '12:00',
    end_time: '13:00',
    duration_hours: '1',
    reason: 'break',
    all_day: false,
    multi_day: false,
    end_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBlocks(); }, [barberId]);

  // When switching to allday, reset reason if it was 'lunch' (not in allday list)
  useEffect(() => {
    if (blockType === 'allday') {
      const alldayValues = REASONS_ALLDAY.map(r => r.value);
      if (!alldayValues.includes(form.reason)) {
        setForm(f => ({ ...f, reason: 'break' }));
      }
    } else {
      const timedValues = REASONS_TIMED.map(r => r.value);
      if (!timedValues.includes(form.reason)) {
        setForm(f => ({ ...f, reason: 'break' }));
      }
    }
  }, [blockType]);

  async function loadBlocks() {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('barber_blocks')
      .select('*')
      .eq('barber_id', barberId)
      .gte('block_date', today)
      .order('block_date')
      .order('start_time');
    if (data) setBlocks(data);
  }

  async function save() {
    setSaving(true);
    const inserts: any[] = [];

    const dates: string[] = [];
    if (form.multi_day) {
      let cur = new Date(form.block_date + 'T00:00:00');
      const end = new Date(form.end_date + 'T00:00:00');
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      dates.push(form.block_date);
    }

    for (const d of dates) {
      if (form.all_day) {
        inserts.push({ barber_id: barberId, block_date: d, start_time: null, end_time: null, reason: form.reason, auto_expires: true });
      } else if (blockType === 'duration') {
        const [sh, sm] = form.start_time.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = startMin + Math.round(parseFloat(form.duration_hours) * 60);
        const eh = Math.floor(endMin / 60);
        const em = endMin % 60;
        const endTime = `${String(Math.min(eh, 19)).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        inserts.push({ barber_id: barberId, block_date: d, start_time: form.start_time + ':00', end_time: endTime + ':00', reason: form.reason, auto_expires: true });
      } else {
        inserts.push({ barber_id: barberId, block_date: d, start_time: form.start_time + ':00', end_time: form.end_time + ':00', reason: form.reason, auto_expires: true });
      }
    }

    await supabase.from('barber_blocks').insert(inserts);
    setSaving(false);
    setShowForm(false);
    loadBlocks();
  }

  async function deleteBlock(id: string) {
    await supabase.from('barber_blocks').delete().eq('id', id);
    loadBlocks();
  }

  function formatBlockTime(block: Block) {
    if (!block.start_time && !block.end_time) return 'Todo el día';
    return `${block.start_time?.slice(0, 5)} → ${block.end_time?.slice(0, 5)}`;
  }

  function formatBlockDate(dateStr: string) {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (dateStr === today) return 'Hoy';
    if (dateStr === tomorrow) return 'Mañana';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  const REASON_LABEL = Object.fromEntries(ALL_REASONS.map(r => [r.value, r.label]));

  const grouped: Record<string, Block[]> = {};
  blocks.forEach(b => {
    if (!grouped[b.block_date]) grouped[b.block_date] = [];
    grouped[b.block_date].push(b);
  });

  const currentReasons = blockType === 'allday' ? REASONS_ALLDAY : REASONS_TIMED;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div className="fc-label" style={{ fontSize: 11, color: 'var(--gray)' }}>
          ⏰ Bloqueos de horario
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--gold)',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            padding: '4px 0',
            whiteSpace: 'nowrap',
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Bloquear horas'}
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          padding: 'clamp(12px, 4vw, 16px)',
          marginBottom: 14,
          border: '1px solid rgba(201,168,76,0.15)',
          boxSizing: 'border-box',
          width: '100%',
        }}>

          {/* Tipo de bloqueo */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            marginBottom: 14,
          }}>
            {([
              { id: 'range',    label: 'Rango',       emoji: '↔️' },
              { id: 'duration', label: 'Duración',     emoji: '⏱' },
              { id: 'allday',   label: 'Todo el día',  emoji: '📅' },
            ] as const).map(t => (
              <button key={t.id}
                onClick={() => {
                  setBlockType(t.id as BlockType);
                  setForm(f => ({ ...f, all_day: t.id === 'allday' }));
                }}
                style={{
                  padding: 'clamp(6px, 2vw, 10px) 4px',
                  borderRadius: 8,
                  border: `1px solid ${blockType === t.id ? 'var(--gold)' : 'rgba(255,255,255,0.08)'}`,
                  background: blockType === t.id ? 'var(--gold-dim)' : 'transparent',
                  color: blockType === t.id ? 'var(--gold)' : 'var(--gray)',
                  cursor: 'pointer',
                  fontSize: 'clamp(10px, 3vw, 12px)',
                  fontWeight: 600,
                  transition: 'all 0.15s',
                  lineHeight: 1.4,
                }}
              >
                <div style={{ fontSize: 'clamp(14px, 4vw, 18px)', marginBottom: 2 }}>{t.emoji}</div>
                <div>{t.label}</div>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Motivo */}
            <div>
              <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>
                Motivo
              </label>
              <select
                className="fc-input"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box' }}
              >
                {currentReasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Rango de fechas */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)' }}>¿Varios días?</label>
                <button
                  onClick={() => setForm(f => ({ ...f, multi_day: !f.multi_day }))}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    background: form.multi_day ? 'var(--gold)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: form.multi_day ? 20 : 2,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: 'white',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: form.multi_day ? '1fr 1fr' : '1fr',
                gap: 8,
              }}>
                <div>
                  <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>
                    {form.multi_day ? 'Desde' : 'Fecha'}
                  </label>
                  <input
                    type="date"
                    className="fc-input"
                    value={form.block_date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setForm(f => ({ ...f, block_date: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                {form.multi_day && (
                  <div>
                    <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Hasta</label>
                    <input
                      type="date"
                      className="fc-input"
                      value={form.end_date}
                      min={form.block_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Horario: Rango */}
            {blockType === 'range' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Desde</label>
                  <select
                    className="fc-input"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Hasta</label>
                  <select
                    className="fc-input"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {TIME_SLOTS.filter(t => t > form.start_time).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Horario: Duración */}
            {blockType === 'duration' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Desde</label>
                  <select
                    className="fc-input"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 4 }}>Duración</label>
                  <select
                    className="fc-input"
                    value={form.duration_hours}
                    onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    {['0.5', '1', '1.5', '2', '2.5', '3', '4'].map(h => (
                      <option key={h} value={h}>{h === '0.5' ? '30 min' : `${h} hrs`}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Todo el día: info visual */}
            {blockType === 'allday' && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(201,168,76,0.06)',
                border: '1px solid rgba(201,168,76,0.12)',
                fontSize: 12,
                color: 'var(--gray)',
                lineHeight: 1.5,
              }}>
                {form.reason === 'vacation'
                  ? '🌴 Se bloqueará el día completo como vacaciones'
                  : '📅 Se bloqueará el día completo sin disponibilidad'}
              </div>
            )}

            <button
              className="fc-btn-gold"
              disabled={saving}
              onClick={save}
              style={{ padding: 'clamp(10px, 3vw, 12px)', width: '100%', boxSizing: 'border-box' }}
            >
              {saving ? 'Guardando...' : '🔒 Bloquear horario'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de bloqueos activos */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--gray)', fontSize: 13 }}>
          Sin bloqueos programados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(grouped).map(([date, dateBlocks]) => (
            <div key={date}>
              <div className="fc-label" style={{ fontSize: 10, color: 'var(--gold)', marginBottom: 5, letterSpacing: 2 }}>
                {formatBlockDate(date)}
              </div>
              {dateBlocks.map(b => (
                <div key={b.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: 'clamp(8px, 2.5vw, 10px) clamp(10px, 3vw, 12px)',
                  background: b.reason === 'vacation'
                    ? 'rgba(52,152,219,0.06)'
                    : 'rgba(231,76,60,0.06)',
                  border: `1px solid ${b.reason === 'vacation'
                    ? 'rgba(52,152,219,0.18)'
                    : 'rgba(231,76,60,0.15)'}`,
                  borderRadius: 8,
                  marginBottom: 6,
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 'clamp(12px, 3.5vw, 13px)', color: 'var(--cream)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {REASON_LABEL[b.reason] || b.reason}
                    </div>
                    <div style={{ fontSize: 'clamp(11px, 3vw, 12px)', color: 'var(--gray)', marginTop: 2 }}>
                      🕐 {formatBlockTime(b)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBlock(b.id)}
                    style={{
                      background: b.reason === 'vacation'
                        ? 'rgba(52,152,219,0.1)'
                        : 'rgba(231,76,60,0.1)',
                      border: 'none',
                      color: b.reason === 'vacation' ? '#3498DB' : '#E74C3C',
                      padding: 'clamp(5px, 1.5vw, 6px) clamp(8px, 2.5vw, 10px)',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
