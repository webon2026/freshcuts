'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Barber } from '@/types';
import { BARBER_STATUS_LABELS } from '@/lib/utils';
import BlockSchedule from '@/components/admin/shared/BlockSchedule';

const EMOJIS = ['✂️','💈','🪒','👑','⚡','🔥','💎','🌟'];

const STATUS_OPTIONS: { value: Barber['status']; label: string; color: string }[] = [
  { value: 'available', label: 'Disponible',    color: 'var(--green)' },
  { value: 'busy',      label: 'En atención',   color: '#E67E22' },
  { value: 'break',     label: 'Descanso',      color: '#F1C40F' },
  { value: 'off',       label: 'No disponible', color: '#E74C3C' },
];

export default function BarbersTab() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', username: '', phone: '', avatar_emoji: '✂️', role: 'barber' as const });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadBarbers(); }, []);

  async function loadBarbers() {
    const { data } = await supabase.from('barbers').select('*').order('sort_order');
    if (data) setBarbers(data);
  }

  function openEdit(b: Barber) {
    setEditing(b);
    setForm({ name: b.name, username: b.username, phone: b.phone, avatar_emoji: b.avatar_emoji, role: b.role });
    setNewPassword('');
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.username) return;
    setSaving(true);
    if (editing) {
      await supabase.from('barbers').update(form).eq('id', editing.id);
      if (newPassword) await supabase.from('settings').upsert({ key: `pwd_${editing.id}`, value: newPassword }, { onConflict: 'key' });
    } else {
      const { data } = await supabase.from('barbers').insert({ ...form, active: true }).select().single();
      if (data && newPassword) await supabase.from('settings').insert({ key: `pwd_${data.id}`, value: newPassword });
    }
    setSaving(false);
    setShowForm(false);
    loadBarbers();
  }

  async function changeStatus(b: Barber, status: Barber['status']) {
    await supabase.from('barbers').update({ status }).eq('id', b.id);
    setBarbers(prev => prev.map(x => x.id === b.id ? { ...x, status } : x));
  }

  async function toggleActive(b: Barber) {
    await supabase.from('barbers').update({ active: !b.active }).eq('id', b.id);
    loadBarbers();
  }

  if (showForm) return (
    <div className="anim-fadeup">
      <button onClick={() => setShowForm(false)} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, fontSize: 13 }}>← Volver</button>
      <h2 className="fc-title" style={{ fontSize: 24, color: 'var(--gold)', marginBottom: 18 }}>
        {editing ? `Editar — ${editing.name}` : 'Nuevo barbero'}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Nombre *</label>
          <input className="fc-input" placeholder="Nombre del barbero" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>Usuario (para login) *</label>
          <input className="fc-input" placeholder="ej: carlos" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value.toLowerCase().replace(/\s/g,'')}))} autoCapitalize="none" />
          <div style={{ color: 'var(--gray)', fontSize: 11, marginTop: 3 }}>Solo letras y números, sin espacios</div>
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>WhatsApp</label>
          <input className="fc-input" placeholder="+56 9 1234 5678" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 7 }}>Icono</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setForm(f => ({...f, avatar_emoji: e}))}
                style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${form.avatar_emoji === e ? 'var(--gold)' : 'rgba(255,255,255,0.1)'}`, background: form.avatar_emoji === e ? 'var(--gold-dim)' : 'transparent', fontSize: 22, cursor: 'pointer', transition: 'all 0.15s' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>
            {editing ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña *'}
          </label>
          <input className="fc-input" type="password" placeholder={editing ? 'Nueva contraseña...' : 'Contraseña de acceso'} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          {!editing && <div style={{ color: 'var(--gray)', fontSize: 11, marginTop: 3 }}>Por defecto: "freshcuts2026"</div>}
        </div>
        <button className="fc-btn-gold" disabled={saving || !form.name || !form.username} onClick={save} style={{ padding: 13 }}>
          {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar barbero'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)' }}>Equipo</h2>
        <button className="fc-btn-gold" style={{ padding: '8px 14px', fontSize: 12 }}
          onClick={() => { setEditing(null); setForm({ name: '', username: '', phone: '', avatar_emoji: '✂️', role: 'barber' }); setShowForm(true); }}>
          + Barbero
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {barbers.map(b => {
          const sl = BARBER_STATUS_LABELS[b.status];
          const isExpanded = expandedBlocks === b.id;
          return (
            <div key={b.id} className="fc-card" style={{ overflow: 'hidden', opacity: b.active ? 1 : 0.5 }}>
              {/* Info barbero */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {b.avatar_emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {b.name}
                    {b.role === 'owner' && <span style={{ fontSize: 9, background: 'var(--gold-dim)', color: 'var(--gold)', padding: '2px 6px', borderRadius: 8 }} className="fc-label">DUEÑO</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray)', marginTop: 1 }}>@{b.username}</div>
                  {/* Selector de estado inline */}
                  <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(s => (
                      <button key={s.value} onClick={() => changeStatus(b, s.value)}
                        style={{ padding: '3px 9px', borderRadius: 10, border: `1px solid ${b.status === s.value ? s.color : 'rgba(255,255,255,0.08)'}`, background: b.status === s.value ? `${s.color}20` : 'transparent', color: b.status === s.value ? s.color : 'var(--gray)', cursor: 'pointer', fontSize: 10, fontWeight: 600, transition: 'all 0.15s' }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setExpandedBlocks(isExpanded ? null : b.id)}
                    style={{ background: isExpanded ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.05)', border: 'none', color: isExpanded ? 'var(--gold)' : 'var(--gray)', padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    ⏰
                  </button>
                  <button onClick={() => openEdit(b)}
                    style={{ background: 'rgba(201,168,76,0.1)', border: 'none', color: 'var(--gold)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    Editar
                  </button>
                  {b.role !== 'owner' && (
                    <button onClick={() => toggleActive(b)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--gray)', padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                      {b.active ? '👁' : '🚫'}
                    </button>
                  )}
                </div>
              </div>

              {/* Panel de bloqueos expandible */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: 'rgba(255,255,255,0.02)' }}>
                  <BlockSchedule barberId={b.id} barberName={b.name} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
