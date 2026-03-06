'use client';
import { useState, useEffect } from 'react';
import { AdminSession, Barber } from '@/types';
import { supabase } from '@/lib/supabase';
import { BARBER_STATUS_LABELS } from '@/lib/utils';
import AppointmentsTab from './tabs/AppointmentsTab';
import BarbersTab from './tabs/BarbersTab';
import ProductsTab from './tabs/ProductsTab';
import SettingsTab from './tabs/SettingsTab';

type Tab = 'appointments' | 'barbers' | 'products' | 'settings';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'appointments', label: 'Citas',     emoji: '📅' },
  { id: 'barbers',      label: 'Equipo',    emoji: '✂️' },
  { id: 'products',     label: 'Productos', emoji: '🛍️' },
  { id: 'settings',     label: 'Config',    emoji: '⚙️' },
];

const STATUS_OPTIONS: { value: Barber['status']; label: string; emoji: string; color: string }[] = [
  { value: 'available', label: 'Disponible',    emoji: '✅', color: 'var(--green)' },
  { value: 'busy',      label: 'En atención',   emoji: '✂️', color: '#E67E22' },
  { value: 'break',     label: 'Descanso',      emoji: '☕', color: '#F1C40F' },
  { value: 'off',       label: 'No disponible', emoji: '🔴', color: '#E74C3C' },
];

interface Props {
  session: AdminSession;
  onLogout: () => void;
}

export default function OwnerPanel({ session, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('appointments');
  const [myBarber, setMyBarber] = useState<Barber | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  useEffect(() => {
    loadMyBarber();
  }, []);

  async function loadMyBarber() {
    const { data } = await supabase
      .from('barbers')
      .select('*')
      .eq('id', session.barber_id)
      .single();
    if (data) setMyBarber(data);
  }

  async function setMyStatus(status: Barber['status']) {
    await supabase.from('barbers').update({ status }).eq('id', session.barber_id);
    setMyBarber(b => b ? { ...b, status } : b);
    setShowStatusPicker(false);
  }

  const currentStatus = STATUS_OPTIONS.find(s => s.value === myBarber?.status);

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>

      {/* Header */}
      <div style={{
        background: 'var(--dark)',
        borderBottom: '1px solid rgba(201,168,76,0.2)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
        gap: 10,
      }}>
        {/* Logo + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src="/logo.jpg" alt="Fresh Cuts" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(201,168,76,0.3)', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div className="fc-title" style={{ fontSize: 18, color: 'var(--gold)', lineHeight: 1 }}>FRESH CUTS</div>
            <div className="fc-label" style={{ fontSize: 9, color: 'var(--gray)', letterSpacing: 2 }}>👑 {session.name}</div>
          </div>
        </div>

        {/* Mi estado */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${currentStatus?.color || 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20, padding: '6px 12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: currentStatus?.color || 'var(--gray)', flexShrink: 0 }} />
            <span className="fc-label" style={{ fontSize: 10, color: currentStatus?.color || 'var(--gray)', letterSpacing: 1 }}>
              {currentStatus?.label || 'Estado'}
            </span>
            <span style={{ color: 'var(--gray)', fontSize: 10 }}>▾</span>
          </button>

          {/* Dropdown de estado */}
          {showStatusPicker && (
            <div style={{
              position: 'absolute', top: '110%', right: 0,
              background: '#1e1e1e', border: '1px solid rgba(201,168,76,0.2)',
              borderRadius: 12, padding: 8, zIndex: 100,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              minWidth: 170,
            }}>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setMyStatus(s.value)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: myBarber?.status === s.value ? 'rgba(201,168,76,0.1)' : 'transparent',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = myBarber?.status === s.value ? 'rgba(201,168,76,0.1)' : 'transparent'}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ color: s.color, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                  {myBarber?.status === s.value && <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontSize: 12 }}>✓</span>}
                </button>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 0' }} />
              <button onClick={onLogout} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 12, textAlign: 'left', borderRadius: 8 }}>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overlay para cerrar dropdown */}
      {showStatusPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setShowStatusPicker(false)} />
      )}

      {/* Contenido */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        {tab === 'appointments' && <AppointmentsTab isOwner />}
        {tab === 'barbers'      && <BarbersTab />}
        {tab === 'products'     && <ProductsTab />}
        {tab === 'settings'     && <SettingsTab session={session} />}
      </div>

      {/* Nav inferior */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--dark)', borderTop: '1px solid rgba(201,168,76,0.15)',
        display: 'flex', zIndex: 50,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
            color: tab === t.id ? 'var(--gold)' : 'var(--gray)',
            borderTop: tab === t.id ? '2px solid var(--gold)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            <div style={{ fontSize: 18 }}>{t.emoji}</div>
            <div className="fc-label" style={{ fontSize: 9, marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </nav>
    </div>
  );
}
