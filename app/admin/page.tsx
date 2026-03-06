'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getSession, setSession, clearSession } from '@/lib/utils';
import { AdminSession } from '@/types';
import OwnerPanel from '@/components/admin/owner/OwnerPanel';
import BarberPanel from '@/components/admin/barber/BarberPanel';

export default function AdminPage() {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSessionState(s);
    setLoading(false);
  }, []);

  async function login() {
    if (!username || !password) return;
    setLogging(true);
    setError('');

    const { data: barber, error: err } = await supabase
      .from('barbers')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('active', true)
      .single();

    if (err || !barber) {
      setError('Usuario no encontrado');
      setLogging(false);
      return;
    }

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });

    const result = await res.json();

    if (!res.ok || !result.ok) {
      setError(result.message || 'Contraseña incorrecta');
      setLogging(false);
      return;
    }

    const s: AdminSession = {
      barber_id: barber.id,
      name: barber.name,
      role: barber.role,
      username: barber.username,
    };
    setSession(s);
    setSessionState(s);
    setLogging(false);
  }

  function logout() {
    clearSession();
    setSessionState(null);
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)' }}>
      <div style={{ color: 'var(--gold)', fontSize: 18 }}>Cargando...</div>
    </div>
  );

  if (!session) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)', padding: 20 }}>
      <div className="anim-fadeup" style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="fc-title" style={{ fontSize: 42, color: 'var(--gold)' }}>FRESH CUTS</div>
          <div className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', letterSpacing: 5, marginTop: 4 }}>PANEL ADMIN</div>
        </div>

        <div className="fc-card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Usuario</label>
              <input className="fc-input" placeholder="tu usuario" value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()} autoCapitalize="none" autoCorrect="off" />
            </div>
            <div>
              <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Contraseña</label>
              <input className="fc-input" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()} />
            </div>
            {error && <div style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>{error}</div>}
            <button className="fc-btn-gold" style={{ width: '100%', padding: 14, marginTop: 4 }} disabled={logging || !username || !password} onClick={login}>
              {logging ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--gray)', fontSize: 12, marginTop: 20 }}>
          Solo para el equipo de Fresh Cuts
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--black)' }}>
      {session.role === 'owner'
        ? <OwnerPanel session={session} onLogout={logout} />
        : <BarberPanel session={session} onLogout={logout} />
      }
    </div>
  );
}
