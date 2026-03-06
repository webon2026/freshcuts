'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, Barber, Product } from '@/types';
import { formatPrice, formatTime, BARBER_STATUS_LABELS } from '@/lib/utils';

const SLIDE_DURATION = 8000;
const SLIDES = ['agenda', 'team', 'products'] as const;
type Slide = typeof SLIDES[number];

export default function DashboardTV() {
  const [slide, setSlide] = useState<Slide>('agenda');
  const [transitioning, setTransitioning] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Record<string,string>>({});
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadAll();
    const channel = supabase.channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadAppointments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers' }, loadBarbers)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, loadProducts)
      .subscribe();
    const clockTimer = setInterval(() => setTime(new Date()), 1000);
    return () => { supabase.removeChannel(channel); clearInterval(clockTimer); };
  }, []);

  useEffect(() => { startSlideTimer(); return () => stopTimers(); }, [slide]);

  function stopTimers() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progRef.current) clearInterval(progRef.current);
  }

  function startSlideTimer() {
    stopTimers(); setProgress(0);
    const start = Date.now();
    progRef.current = setInterval(() => setProgress(Math.min(100, ((Date.now() - start) / SLIDE_DURATION) * 100)), 50);
    timerRef.current = setTimeout(nextSlide, SLIDE_DURATION);
  }

  function nextSlide() {
    setTransitioning(true);
    setTimeout(() => { setSlide(s => SLIDES[(SLIDES.indexOf(s) + 1) % SLIDES.length]); setTransitioning(false); }, 400);
  }

  async function loadAll() { await Promise.all([loadAppointments(), loadBarbers(), loadProducts(), loadSettings()]); }

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('key,value');
    if (data) { const m: Record<string,string> = {}; data.forEach(s => { m[s.key]=s.value; }); setSettings(m); }
  }

  async function loadAppointments() {
    const today = new Date().toISOString().slice(0,10);
    const { data } = await supabase
      .from('appointments')
      .select('*, barber:barbers(*), service:services(*)')
      .eq('appointment_date', today)
      // Solo pending, confirmed e in_progress — los atendidos NO se muestran
      .in('status', ['pending', 'confirmed', 'in_progress'])
      .order('appointment_time');
    if (data) setAppointments(data as Appointment[]);
  }

  async function loadBarbers() {
    const { data } = await supabase.from('barbers').select('*').eq('active', true).order('sort_order');
    if (data) setBarbers(data);
  }

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*, category:categories(*)').eq('active', true).gt('stock', 0).order('sort_order').limit(8);
    if (data) setProducts(data as Product[]);
  }

  const h = String(time.getHours()).padStart(2,'0');
  const m = String(time.getMinutes()).padStart(2,'0');
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dateStr = `${days[time.getDay()]} ${time.getDate()} de ${months[time.getMonth()]}`;

  // Separar en atención vs próximos
  const inProgress = appointments.filter(a => a.status === 'in_progress');
  const upcoming = appointments.filter(a => a.status !== 'in_progress');

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--black)', overflow: 'hidden', position: 'relative', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(201,168,76,0.012) 40px, rgba(201,168,76,0.012) 41px)', pointerEvents: 'none' }} />

      {/* HEADER */}
      <div style={{ height: 88, background: 'linear-gradient(90deg,#0a0a0a,#1a1a1a,#0a0a0a)', borderBottom: '2px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px' }}>
        <div>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 50, color: 'var(--gold)', letterSpacing: 6, lineHeight: 1, textShadow: '0 0 30px rgba(201,168,76,0.3)' }}>FRESH CUTS</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, color: 'var(--gray)', letterSpacing: 5 }}>SALÓN · SINCE 2018</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray)', fontFamily: 'Barlow Condensed', fontSize: 16, letterSpacing: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
          EN VIVO
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Bebas Neue', fontSize: 46, letterSpacing: 4 }}>{h}:{m}</div>
          <div style={{ fontFamily: 'Barlow Condensed', fontSize: 14, color: 'var(--gray)', letterSpacing: 2, textTransform: 'uppercase' }}>{dateStr}</div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{ position: 'absolute', top: 88, left: 0, right: 0, bottom: 56, padding: '32px 60px', opacity: transitioning ? 0 : 1, transform: transitioning ? 'translateX(40px)' : 'none', transition: 'opacity 0.4s ease, transform 0.4s ease', overflowY: 'hidden' }}>

        {/* ── AGENDA ── */}
        {slide === 'agenda' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* En atención ahora */}
            {inProgress.length > 0 && (
              <div>
                <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, letterSpacing: 5, color: 'var(--green)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
                  EN ATENCIÓN AHORA
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(46,204,113,0.3), transparent)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(inProgress.length, 3)}, 1fr)`, gap: 14 }}>
                  {inProgress.map(a => (
                    <div key={a.id} style={{ background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.4)', borderLeft: '4px solid var(--green)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 18 }}>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 44, color: 'var(--green)', lineHeight: 1, minWidth: 100 }}>{formatTime(a.appointment_time)}</div>
                      <div>
                        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 26, fontWeight: 700, textTransform: 'uppercase' }}>{a.client_name}</div>
                        <div style={{ color: 'var(--gray)', fontSize: 14, marginTop: 2 }}>{a.service?.name}</div>
                        <div style={{ color: 'var(--green)', fontSize: 12, marginTop: 3, letterSpacing: 1 }}>✂️ {a.barber?.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Próximas citas */}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, letterSpacing: 5, color: 'var(--gold)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                📅 PRÓXIMAS CITAS
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(201,168,76,0.3), transparent)' }} />
                <span style={{ fontSize: 11, color: 'var(--gray)' }}>{upcoming.length} pendiente{upcoming.length !== 1 ? 's' : ''}</span>
              </div>

              {upcoming.length === 0 && inProgress.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray)' }}>
                  <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
                  <div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, letterSpacing: 3 }}>No hay más citas pendientes hoy</div>
                </div>
              ) : upcoming.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--gray)', fontFamily: 'Barlow Condensed', fontSize: 18, letterSpacing: 2 }}>
                  No hay más citas en espera
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {upcoming.slice(0, 6).map(a => (
                    <div key={a.id} style={{ background: 'var(--card)', border: '1px solid rgba(201,168,76,0.15)', borderLeft: '4px solid var(--gold)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontFamily: 'Bebas Neue', fontSize: 40, color: 'var(--gold)', lineHeight: 1, minWidth: 90 }}>{formatTime(a.appointment_time)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 22, fontWeight: 700, textTransform: 'uppercase' }}>{a.client_name}</div>
                        <div style={{ color: 'var(--gray)', fontSize: 13, marginTop: 2 }}>{a.service?.name}</div>
                        <div style={{ color: 'rgba(201,168,76,0.6)', fontSize: 11, marginTop: 3 }}>✂️ {a.barber?.name}</div>
                      </div>
                      <div style={{ fontFamily: 'Barlow Condensed', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 16, background: a.status === 'confirmed' ? 'rgba(46,204,113,0.1)' : 'rgba(241,196,15,0.1)', color: a.status === 'confirmed' ? 'var(--green)' : '#F1C40F', fontWeight: 700 }}>
                        {a.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EQUIPO ── */}
        {slide === 'team' && (
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, letterSpacing: 5, color: 'var(--gold)', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              ✂️ NUESTRO EQUIPO
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(201,168,76,0.3), transparent)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(barbers.length, 4)}, 1fr)`, gap: 24 }}>
              {barbers.map(b => {
                const sl = BARBER_STATUS_LABELS[b.status];
                const colorMap: Record<string, string> = { available: 'var(--green)', busy: '#E67E22', break: '#F1C40F', off: '#E74C3C' };
                const borderColor = colorMap[b.status] || 'var(--gray)';
                return (
                  <div key={b.id} style={{ background: 'var(--card)', border: '1px solid rgba(201,168,76,0.15)', borderTop: `3px solid ${borderColor}`, borderRadius: 16, padding: '36px 24px', textAlign: 'center' }}>
                    <div style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(201,168,76,0.08)', border: `2px solid ${borderColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46 }}>
                      {b.avatar_emoji}
                    </div>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 34, letterSpacing: 3, marginBottom: 10 }}>{b.name}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 18px', borderRadius: 20, background: `${borderColor}18`, border: `1px solid ${borderColor}40` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: borderColor }} />
                      <span style={{ color: borderColor, fontSize: 13, fontFamily: 'Barlow Condensed', letterSpacing: 2, fontWeight: 700 }}>{sl?.label || b.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PRODUCTOS ── */}
        {slide === 'products' && (
          <div>
            <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, letterSpacing: 5, color: 'var(--gold)', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
              🛍️ DISPONIBLE EN TIENDA — PREGUNTA EN CAJA
              <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(201,168,76,0.3), transparent)' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18 }}>
              {products.map(p => (
                <div key={p.id} style={{ background: 'var(--card)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ height: 200, background: p.image_url ? `url(${p.image_url}) center/cover` : 'linear-gradient(135deg,#1e1e1e,#2a2a2a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60, position: 'relative' }}>
                    {!p.image_url && '🛍️'}
                    {p.badge && (
                      <div style={{ position: 'absolute', top: 10, right: 10, background: p.badge === 'hot' ? '#C0392B' : 'var(--gold)', color: p.badge === 'hot' ? 'white' : 'var(--black)', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10, fontFamily: 'Barlow Condensed', letterSpacing: 2 }}>
                        {p.badge === 'hot' ? '🔥 POPULAR' : '✨ NUEVO'}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ fontFamily: 'Barlow Condensed', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ color: 'var(--gray)', fontSize: 12, marginBottom: 8 }}>{p.description}</div>
                    <div style={{ fontFamily: 'Bebas Neue', fontSize: 30, color: 'var(--gold)', letterSpacing: 2 }}>{formatPrice(p.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: 56, background: 'var(--dark)', borderTop: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', padding: '0 60px', gap: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {SLIDES.map(s => (
            <div key={s} style={{ height: 4, borderRadius: 2, background: slide === s ? 'var(--gold)' : 'rgba(255,255,255,0.1)', width: slide === s ? 50 : 28, transition: 'all 0.3s' }} />
          ))}
        </div>
        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--gold),var(--gold-l))', width: `${progress}%`, borderRadius: 2, transition: 'width 0.1s linear' }} />
        </div>
        <div style={{ fontFamily: 'Barlow Condensed', fontSize: 13, color: 'var(--gray)', letterSpacing: 3, textTransform: 'uppercase' }}>
          {settings.business_name || 'FRESH CUTS'} · {settings.business_address || 'Santiago, Chile'}
        </div>
      </div>
    </div>
  );
}
