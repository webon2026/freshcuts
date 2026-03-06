'use client';
import { useState } from 'react';
import BookingFlow from '@/components/public/booking/BookingFlow';
import CatalogView from '@/components/public/catalog/CatalogView';

type View = 'home' | 'booking' | 'catalog';

export default function HomePage() {
  const [view, setView] = useState<View>('home');

  if (view === 'booking') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--black)' }}>
        <header style={{
          background: 'linear-gradient(180deg,#111 0%,#0a0a0a 100%)',
          borderBottom: '1px solid rgba(201,168,76,0.2)',
          padding: '0 20px',
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64,
        }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.jpg" alt="Fresh Cuts" style={{ height: 42, width: 42, objectFit: 'cover', borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)' }} />
          </button>
          <div className="fc-label" style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 4 }}>RESERVAR HORA</div>
          <button onClick={() => setView('catalog')} style={{ background: 'none', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }} className="fc-label">
            🛍️ Tienda
          </button>
        </header>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px 80px' }}>
          <BookingFlow />
        </div>
      </main>
    );
  }

  if (view === 'catalog') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--black)' }}>
        <header style={{
          background: 'linear-gradient(180deg,#111 0%,#0a0a0a 100%)',
          borderBottom: '1px solid rgba(201,168,76,0.2)',
          padding: '0 20px',
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 64,
        }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <img src="/logo.jpg" alt="Fresh Cuts" style={{ height: 42, width: 42, objectFit: 'cover', borderRadius: '50%', border: '1px solid rgba(201,168,76,0.3)' }} />
          </button>
          <div className="fc-label" style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: 4 }}>TIENDA</div>
          <button onClick={() => setView('booking')} style={{ background: 'none', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--gold)', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12 }} className="fc-label">
            📅 Reservar
          </button>
        </header>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px 80px' }}>
          <CatalogView />
        </div>
      </main>
    );
  }

  // ── HOME / LANDING ──
  return (
    <main style={{ minHeight: '100vh', background: 'var(--black)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>

      {/* Fondo decorativo */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* Gradiente radial desde el centro */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(201,168,76,0.07) 0%, transparent 70%)' }} />
        {/* Líneas diagonales */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 60px, rgba(201,168,76,0.018) 60px, rgba(201,168,76,0.018) 61px)' }} />
        {/* Línea horizontal decorativa arriba */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
        {/* Línea horizontal decorativa abajo */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 480 }}>

        {/* ── LOGO ── */}
        <div style={{ marginBottom: 32, animation: 'logoIn 0.8s ease both' }}>
          <div style={{
            width: 160, height: 160,
            margin: '0 auto',
            borderRadius: '50%',
            padding: 3,
            background: 'linear-gradient(135deg, var(--gold), rgba(201,168,76,0.3), var(--gold))',
            boxShadow: '0 0 60px rgba(201,168,76,0.25), 0 0 120px rgba(201,168,76,0.1)',
          }}>
            <img
              src="/logo.jpg"
              alt="Salón Fresh Cuts"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
            />
          </div>
        </div>

        {/* ── BIENVENIDA ── */}
        <div style={{ animation: 'fadeUp 0.6s ease 0.2s both' }}>
          <div className="fc-label" style={{ fontSize: 11, color: 'var(--gold)', letterSpacing: 8, marginBottom: 10 }}>
            BIENVENIDO A
          </div>
          <div className="fc-title" style={{ fontSize: 52, color: 'var(--cream)', lineHeight: 1, marginBottom: 6, textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
            SALÓN
          </div>
          <div className="fc-title" style={{ fontSize: 52, color: 'var(--gold)', lineHeight: 1, marginBottom: 20, textShadow: '0 0 30px rgba(201,168,76,0.3)' }}>
            FRESH CUTS
          </div>
          <div style={{ width: 60, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', margin: '0 auto 20px' }} />
          <p style={{ color: 'var(--gray)', fontSize: 15, lineHeight: 1.6, marginBottom: 48 }}>
            Elige lo que necesitas hoy
          </p>
        </div>

        {/* ── OPCIONES ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, animation: 'fadeUp 0.6s ease 0.4s both' }}>

          {/* Reservar hora */}
          <button
            onClick={() => setView('booking')}
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #222 100%)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 20,
              padding: '32px 20px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--gold)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(201,168,76,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.6 }} />
            <div style={{ fontSize: 44, marginBottom: 14 }}>✂️</div>
            <div className="fc-title" style={{ fontSize: 22, color: 'var(--gold)', marginBottom: 8, letterSpacing: 1 }}>
              RESERVAR
            </div>
            <div className="fc-title" style={{ fontSize: 22, color: 'var(--cream)', letterSpacing: 1, marginBottom: 12 }}>
              MI HORA
            </div>
            <div style={{ color: 'var(--gray)', fontSize: 12, lineHeight: 1.5 }}>
              Agenda con tu barbero favorito en minutos
            </div>
          </button>

          {/* Tienda */}
          <button
            onClick={() => setView('catalog')}
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #222 100%)',
              border: '1px solid rgba(201,168,76,0.3)',
              borderRadius: 20,
              padding: '32px 20px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.3s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--gold)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 16px 40px rgba(201,168,76,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(201,168,76,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, var(--gold), transparent)', opacity: 0.6 }} />
            <div style={{ fontSize: 44, marginBottom: 14 }}>🛍️</div>
            <div className="fc-title" style={{ fontSize: 22, color: 'var(--gold)', marginBottom: 8, letterSpacing: 1 }}>
              NUESTRA
            </div>
            <div className="fc-title" style={{ fontSize: 22, color: 'var(--cream)', letterSpacing: 1, marginBottom: 12 }}>
              TIENDA
            </div>
            <div style={{ color: 'var(--gray)', fontSize: 12, lineHeight: 1.5 }}>
              Productos y ropa del salón
            </div>
          </button>
        </div>

        {/* Estrellas decorativas */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 6, animation: 'fadeUp 0.6s ease 0.6s both' }}>
          {[...Array(5)].map((_, i) => (
            <span key={i} style={{ color: 'var(--gold)', fontSize: 14, opacity: 0.7 }}>★</span>
          ))}
        </div>
        <div className="fc-label" style={{ fontSize: 10, color: 'var(--gray)', letterSpacing: 4, marginTop: 8, animation: 'fadeUp 0.6s ease 0.7s both' }}>
          SINCE 2018
        </div>

      </div>

      <style>{`
        @keyframes logoIn {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
