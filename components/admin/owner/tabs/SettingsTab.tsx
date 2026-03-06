'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Service, AdminSession } from '@/types';
import { formatPrice } from '@/lib/utils';

interface Props { session: AdminSession }

export default function SettingsTab({ session }: Props) {
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [svcForm, setSvcForm] = useState({ name: '', description: '', price: 0, duration_minutes: 30 });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: sets }, { data: svcs }] = await Promise.all([
      supabase.from('settings').select('key,value'),
      supabase.from('services').select('*').order('sort_order'),
    ]);
    if (sets) {
      const map: Record<string,string> = {};
      sets.forEach(s => { map[s.key] = s.value; });
      setSettings(map);
    }
    if (svcs) setServices(svcs);
  }

  async function saveSettings() {
    setSaving(true);
    const upserts = Object.entries(settings).map(([key, value]) => ({ key, value }));
    await supabase.from('settings').upsert(upserts, { onConflict: 'key' });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function saveService() {
    if (!svcForm.name || !svcForm.price) return;
    if (editingService) {
      await supabase.from('services').update(svcForm).eq('id', editingService.id);
    } else {
      await supabase.from('services').insert({ ...svcForm, active: true });
    }
    setShowServiceForm(false);
    loadAll();
  }

  async function toggleService(s: Service) {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id);
    loadAll();
  }

  async function deleteService(id: string) {
    if (!confirm('¿Eliminar servicio?')) return;
    await supabase.from('services').delete().eq('id', id);
    loadAll();
  }

  return (
    <div>
      <h2 className="fc-title" style={{ fontSize: 28, color: 'var(--gold)', marginBottom: 20 }}>Configuración</h2>

      {/* Datos del negocio */}
      <div className="fc-card" style={{ padding: 20, marginBottom: 20 }}>
        <div className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', marginBottom: 14 }}>Datos del negocio</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { key: 'business_name', label: 'Nombre del salón', placeholder: 'Salón Fresh Cuts' },
            { key: 'business_address', label: 'Dirección', placeholder: 'Ej: Av. Principal 123, Santiago' },
            { key: 'business_hours', label: 'Horario', placeholder: 'Ej: Lun-Sáb 10:00 - 20:00' },
            { key: 'whatsapp_number', label: 'WhatsApp del salón (sin +)', placeholder: '56998811877' },
          ].map(f => (
            <div key={f.key}>
              <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input className="fc-input" placeholder={f.placeholder} value={settings[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
        <button className="fc-btn-gold" style={{ width: '100%', padding: 12, marginTop: 16 }} disabled={saving} onClick={saveSettings}>
          {saved ? '✅ Guardado' : saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {/* Servicios */}
      <div className="fc-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="fc-label" style={{ fontSize: 11, color: 'var(--gray)' }}>Servicios</div>
          <button onClick={() => { setEditingService(null); setSvcForm({ name: '', description: '', price: 0, duration_minutes: 30 }); setShowServiceForm(!showServiceForm); }}
            style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}>
            {showServiceForm ? '✕ Cancelar' : '+ Agregar'}
          </button>
        </div>

        {showServiceForm && (
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input className="fc-input" placeholder="Nombre del servicio" value={svcForm.name} onChange={e => setSvcForm(f => ({...f, name: e.target.value}))} />
              <input className="fc-input" placeholder="Descripción breve" value={svcForm.description} onChange={e => setSvcForm(f => ({...f, description: e.target.value}))} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="fc-input" type="number" placeholder="Precio" value={svcForm.price || ''} onChange={e => setSvcForm(f => ({...f, price: Number(e.target.value)}))} />
                <input className="fc-input" type="number" placeholder="Duración (min)" value={svcForm.duration_minutes || ''} onChange={e => setSvcForm(f => ({...f, duration_minutes: Number(e.target.value)}))} />
              </div>
              <button className="fc-btn-gold" onClick={saveService} style={{ padding: 10 }}>
                {editingService ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {services.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: s.active ? 1 : 0.4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ color: 'var(--gray)', fontSize: 12 }}>{formatPrice(s.price)} · {s.duration_minutes} min</div>
              </div>
              <button onClick={() => { setEditingService(s); setSvcForm({ name: s.name, description: s.description, price: s.price, duration_minutes: s.duration_minutes }); setShowServiceForm(true); }}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}>Editar</button>
              <button onClick={() => toggleService(s)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 14 }}>
                {s.active ? '👁' : '🚫'}
              </button>
              <button onClick={() => deleteService(s.id)} style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: 16 }}>🗑</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
