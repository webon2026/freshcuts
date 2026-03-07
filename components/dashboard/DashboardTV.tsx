'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Appointment, Barber, Product } from '@/types';
import { formatPrice, formatTime, BARBER_STATUS_LABELS } from '@/lib/utils';

const LOGO_SRC = '/logo.jpg';

const PRODUCT_INTERVAL = 5000;
const PRODUCTS_PER_PAGE = 4;

// ─── Tiempos de carrusel ──────────────────────────────────────────────────────
const INTERVAL_BARBERIA = 4000;
const INTERVAL_ROPA     = 5000;
// ─────────────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes wv1{0%,100%{height:8px}50%{height:38px}}
  @keyframes wv2{0%,100%{height:20px}30%{height:6px}70%{height:42px}}
  @keyframes wv3{0%,100%{height:32px}40%{height:8px}80%{height:26px}}
  @keyframes wv4{0%,100%{height:12px}25%{height:40px}75%{height:10px}}
  @keyframes wv5{0%,100%{height:26px}50%{height:6px}}
  @keyframes wv6{0%,100%{height:10px}35%{height:36px}65%{height:14px}}
  @keyframes wv7{0%,100%{height:38px}45%{height:8px}}
  @keyframes wv8{0%,100%{height:16px}60%{height:38px}}

  /* Wrapper de par de cards: fade-out → fade-in sin destruir nodos */
  @keyframes pairFadeIn {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0);   }
  }
  @keyframes pairFadeOut {
    from { opacity:1; transform:translateY(0);   }
    to   { opacity:0; transform:translateY(-6px); }
  }

  /* Dot disponible */
  @keyframes availPulse {
    0%,100% { box-shadow:0 0 5px #2ECC71; }
    50%     { box-shadow:0 0 12px #2ECC71, 0 0 22px #2ECC7140; }
  }
  /* Dot EN VIVO */
  @keyframes livePulse {
    0%,100% { box-shadow:0 0 8px #2ECC71; }
    50%     { box-shadow:0 0 18px #2ECC71, 0 0 30px #2ECC7155; }
  }
  /* Citas entrada escalonada */
  @keyframes apptIn {
    from { opacity:0; transform:translateX(-12px); }
    to   { opacity:1; transform:translateX(0);     }
  }

  .pair-entering { animation: pairFadeIn  0.5s cubic-bezier(0.22,1,0.36,1) both; }
  .pair-leaving  { animation: pairFadeOut 0.35s ease both; }
`;

// ── Hook de carrusel sin parpadeo ────────────────────────────────────────────
// Separa "índice visible" de "estado de animación" para que el key del nodo
// nunca cambie durante el fade-out (evita que React desmonte la imagen).
function useCarousel(items: Product[], interval: number, step = 2) {
  const [visibleIdx, setVisibleIdx] = useState(0); // índice actualmente en pantalla
  const [phase, setPhase]           = useState<'idle'|'leaving'|'entering'>('idle');
  const nextIdx = useRef(0);
  const timer   = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (items.length <= step) { setVisibleIdx(0); setPhase('idle'); return; }
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      nextIdx.current = (visibleIdx + step) % items.length;
      // 1. fade-out del par actual
      setPhase('leaving');
      setTimeout(() => {
        // 2. swap de contenido (sin desmontar el DOM)
        setVisibleIdx(nextIdx.current);
        setPhase('entering');
        // 3. volver a idle
        setTimeout(() => setPhase('idle'), 520);
      }, 360);
    }, interval);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [items.length, visibleIdx, interval, step]); // eslint-disable-line

  const i0 = items.length === 0 ? -1 : visibleIdx % items.length;
  const i1 = items.length <= 1 ? -1 : (visibleIdx + 1) % items.length;
  const pair: Product[] = [
    ...(i0 >= 0 ? [items[i0]] : []),
    ...(i1 >= 0 && step > 1 ? [items[i1]] : []),
  ];

  return { pair, phase };
}

export default function DashboardTV() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [barbers, setBarbers]           = useState<Barber[]>([]);
  const [products, setProducts]         = useState<Product[]>([]);
  const [settings, setSettings]         = useState<Record<string,string>>({});
  const [time, setTime]                 = useState(new Date());
  const [productIdx, setProductIdx]     = useState(0);
  const productTimer = useRef<NodeJS.Timeout | null>(null);

  const CAT_BARBERIA = 'e7f975e0-6a8c-41da-ab44-97e47e780fda';
  const CAT_ROPA     = 'e83f91e9-82ac-4a59-bc68-aa5b7d8d68ad';

  const loadAppointments = useCallback(async () => {
    const today   = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    const { data } = await supabase
      .from('appointments')
      .select('*, barber:barbers(*), service:services(*)')
      .eq('appointment_date', today)
      .eq('status', 'confirmed')
      .gte('appointment_time', nowTime)
      .order('appointment_time');
    if (data) setAppointments(data as Appointment[]);
  }, []);

  const loadBarbers = useCallback(async () => {
    const { data } = await supabase.from('barbers').select('*')
      .eq('active', true).eq('role', 'barber').order('sort_order');
    if (data) setBarbers(data);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from('products')
      .select('*, category:categories(*)')
      .eq('active', true).gt('stock', 0).order('sort_order');
    if (data) { setProducts(data as Product[]); setProductIdx(0); }
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('settings').select('key,value');
    if (data) { const m: Record<string,string> = {}; data.forEach(s => { m[s.key] = s.value; }); setSettings(m); }
  }, []);

  const loadAppointmentsRef = useRef(loadAppointments);
  const loadBarbersRef      = useRef(loadBarbers);
  const loadProductsRef     = useRef(loadProducts);
  useEffect(() => { loadAppointmentsRef.current = loadAppointments; }, [loadAppointments]);
  useEffect(() => { loadBarbersRef.current      = loadBarbers; },      [loadBarbers]);
  useEffect(() => { loadProductsRef.current     = loadProducts; },     [loadProducts]);

  useEffect(() => {
    Promise.all([loadAppointments(), loadBarbers(), loadProducts(), loadSettings()]);
    const channel = supabase.channel(`dashboard-tv-${Date.now()}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'appointments' }, () => loadAppointmentsRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'barbers' },      () => loadBarbersRef.current())
      .on('postgres_changes', { event:'*', schema:'public', table:'products' },     () => loadProductsRef.current())
      .subscribe();
    const clockTimer = setInterval(() => setTime(new Date()), 1000);
    const apptTimer  = setInterval(() => loadAppointmentsRef.current(), 60000);
    return () => { supabase.removeChannel(channel); clearInterval(clockTimer); clearInterval(apptTimer); };
  }, []); // eslint-disable-line

  const barberia = products.filter(p => p.category_id === CAT_BARBERIA);
  const ropa     = products.filter(p => p.category_id === CAT_ROPA);

  // Carruseles sin parpadeo
  const { pair: bPair, phase: bPhase } = useCarousel(barberia, INTERVAL_BARBERIA, 2);
  const { pair: rPair, phase: rPhase } = useCarousel(ropa,     INTERVAL_ROPA,     2);

  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dateStr = `${days[time.getDay()]} ${time.getDate()} de ${months[time.getMonth()]}`;
  const colorMap: Record<string,string> = { available:'#2ECC71', busy:'#E67E22', break:'#F1C40F', off:'#E74C3C' };

  const SlideSection = ({
    label, emoji, pair, phase, accentColor,
  }: { label:string; emoji:string; pair:Product[]; phase:'idle'|'leaving'|'entering'; accentColor:string }) => (
    <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden' }}>
      <div style={{ fontFamily:'Barlow Condensed', fontSize:10, letterSpacing:5, color:accentColor, marginBottom:8, display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        {emoji} {label}
        <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${accentColor}40,transparent)` }} />
      </div>

      {/* Wrapper con clase de animación — los nodos internos NO se destruyen */}
      <div
        className={phase === 'leaving' ? 'pair-leaving' : phase === 'entering' ? 'pair-entering' : ''}
        style={{ flex:1, minHeight:0, display:'flex', gap:10 }}
      >
        {pair.length === 0 ? (
          <div style={{ flex:1, borderRadius:14, background:'#111', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize:36 }}>{emoji}</div>
            <div style={{ fontFamily:'Barlow Condensed', fontSize:11, letterSpacing:3 }}>SIN PRODUCTOS</div>
          </div>
        ) : pair.map((p, i) => (
          // Key estable = posición en el par (0 ó 1), nunca el id del producto
          // → React nunca desmonta la imagen, solo actualiza su src
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'row', borderRadius:14, overflow:'hidden', background:'#111', border:'1px solid rgba(255,255,255,0.07)' }}>

            {/* Imagen flush: 42% del ancho, todo el alto */}
            <div style={{ width:'42%', flexShrink:0, position:'relative', overflow:'hidden' }}>
              {p.image_url ? (
                <>
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block' }}
                  />
                  {/* Gradiente de fusión imagen → texto */}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, transparent 55%, #111 100%)' }} />
                </>
              ) : (
                <div style={{ width:'100%', height:'100%', background:'linear-gradient(135deg,#1a1a1a,#222)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 }}>{emoji}</div>
              )}
              {p.badge && (
                <div style={{ position:'absolute', top:8, left:8, background:p.badge==='hot'?'#C0392B':accentColor, color:p.badge==='hot'?'white':'#000', fontSize:9, fontWeight:700, padding:'3px 7px', borderRadius:20, fontFamily:'Barlow Condensed', letterSpacing:1 }}>
                  {p.badge==='hot'?'🔥':'✨'}
                </div>
              )}
            </div>

            {/* Info texto */}
            <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'16px 18px', minWidth:0 }}>
              <div style={{ fontFamily:'Barlow Condensed', fontSize:16, fontWeight:700, color:'rgba(255,255,255,0.92)', textTransform:'uppercase', letterSpacing:1, lineHeight:1.2, marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                {p.name}
              </div>
              {p.description && (
                <div style={{ fontFamily:'Barlow Condensed', fontSize:13, color:'rgba(255,255,255,0.38)', marginBottom:10, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                  {p.description}
                </div>
              )}
              <div style={{ fontFamily:'Bebas Neue', fontSize:28, color:accentColor, letterSpacing:2, textShadow:`0 0 14px ${accentColor}55` }}>
                {formatPrice(p.price)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ width:'100vw', height:'100vh', background:'#0a0a0a', overflow:'hidden', display:'flex', flexDirection:'column', fontFamily:'Barlow, sans-serif', color:'white' }}>

      <style>{CSS}</style>

      <div style={{ position:'fixed', inset:0, backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 40px,rgba(201,168,76,0.008) 40px,rgba(201,168,76,0.009) 41px)', pointerEvents:'none', zIndex:0 }} />

      {/* ══ HEADER ══ */}
      <div style={{ position:'relative', zIndex:1, background:'linear-gradient(180deg,#111,#0d0d0d)', borderBottom:'2px solid rgba(201,168,76,0.5)', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:28, height:86, padding:'0 40px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
            <img src={LOGO_SRC} alt="Fresh Cuts" style={{ height:66, width:66, borderRadius:'50%', objectFit:'cover', border:'2px solid rgba(201,168,76,0.5)', boxShadow:'0 0 18px rgba(201,168,76,0.2)' }} />
            <div>
              <div style={{ fontFamily:'Bebas Neue, sans-serif', fontSize:36, color:'#C9A84C', letterSpacing:6, lineHeight:1, textShadow:'0 0 20px rgba(201,168,76,0.35)' }}>FRESH CUTS</div>
              <div style={{ fontFamily:'Barlow Condensed', fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:5, marginTop:2 }}>SALÓN · SINCE 2018</div>
            </div>
          </div>

          <div style={{ width:1, height:50, background:'rgba(201,168,76,0.2)', flexShrink:0 }} />

          <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, overflow:'hidden' }}>
            <div style={{ fontFamily:'Barlow Condensed', fontSize:10, letterSpacing:4, color:'rgba(201,168,76,0.4)', flexShrink:0 }}>EQUIPO</div>
            <div style={{ display:'flex', gap:8, overflow:'hidden' }}>
              {barbers.map(b => {
                const bc = colorMap[b.status] || '#888';
                const sl = BARBER_STATUS_LABELS[b.status];
                return (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${bc}30`, borderRadius:28, padding:'5px 14px 5px 7px', flexShrink:0 }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:`${bc}15`, border:`2px solid ${bc}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{b.avatar_emoji}</div>
                    <div>
                      <div style={{ fontFamily:'Barlow Condensed', fontSize:15, fontWeight:700, letterSpacing:0.5, lineHeight:1 }}>{b.name}</div>
                      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:3 }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:bc, animation:b.status==='available'?'availPulse 2s ease-in-out infinite':'none' }} />
                        <span style={{ fontSize:10, color:bc, fontFamily:'Barlow Condensed', letterSpacing:1 }}>{sl?.label || b.status}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontFamily:'Bebas Neue', fontSize:50, letterSpacing:4, lineHeight:1 }}>{hh}:{mm}</div>
            <div style={{ fontFamily:'Barlow Condensed', fontSize:11, color:'rgba(255,255,255,0.35)', letterSpacing:3, textTransform:'uppercase', marginTop:2 }}>{dateStr}</div>
          </div>
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'300px 1fr', minHeight:0, position:'relative', zIndex:1 }}>

        {/* ── Citas ── */}
        <div style={{ display:'flex', flexDirection:'column', borderRight:'1px solid rgba(201,168,76,0.15)', background:'rgba(0,0,0,0.3)', overflow:'hidden' }}>
          <div style={{ padding:'18px 20px 12px', borderBottom:'1px solid rgba(201,168,76,0.1)', flexShrink:0 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontSize:10, letterSpacing:5, color:'rgba(201,168,76,0.5)', display:'flex', alignItems:'center', gap:8 }}>
              📅 PRÓXIMAS CITAS
              <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(201,168,76,0.2),transparent)' }} />
            </div>
          </div>
          <div style={{ flex:1, overflowY:'hidden', display:'flex', flexDirection:'column' }}>
            {appointments.length === 0 ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, color:'rgba(255,255,255,0.15)' }}>
                <div style={{ fontSize:36 }}>✅</div>
                <div style={{ fontFamily:'Barlow Condensed', fontSize:13, letterSpacing:2, textAlign:'center', lineHeight:1.4 }}>SIN CITAS<br/>CONFIRMADAS</div>
              </div>
            ) : appointments.map((a, i) => {
              const isFirst = i === 0;
              return (
                <div key={a.id} style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.04)', borderLeft:`3px solid ${isFirst?'#C9A84C':'rgba(255,255,255,0.08)'}`, background:isFirst?'rgba(201,168,76,0.05)':'transparent', flexShrink:0, animation:'apptIn 0.4s cubic-bezier(0.22,1,0.36,1) both', animationDelay:`${i*0.06}s` }}>
                  <div style={{ fontFamily:'Bebas Neue', fontSize:isFirst?34:28, color:isFirst?'#C9A84C':'rgba(255,255,255,0.35)', letterSpacing:2, lineHeight:1, marginBottom:4 }}>{formatTime(a.appointment_time)}</div>
                  <div style={{ fontFamily:'Barlow Condensed', fontSize:isFirst?20:16, fontWeight:700, textTransform:'uppercase', color:isFirst?'white':'rgba(255,255,255,0.6)', letterSpacing:0.5, lineHeight:1, marginBottom:6 }}>{a.client_name}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3 }}>
                    <span style={{ fontSize:14 }}>{(a.barber as any)?.avatar_emoji || '✂️'}</span>
                    <span style={{ fontFamily:'Barlow Condensed', fontSize:12, color:isFirst?'#C9A84C':'rgba(201,168,76,0.5)', letterSpacing:0.5 }}>{a.barber?.name}</span>
                  </div>
                  <div style={{ fontFamily:'Barlow Condensed', fontSize:11, color:'rgba(255,255,255,0.3)', letterSpacing:0.5 }}>{a.service?.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Productos ── */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden', padding:'16px 24px 14px', gap:0, flex:1 }}>
          <SlideSection label="PRODUCTOS DE BARBERÍA" emoji="💈" pair={bPair} phase={bPhase} accentColor="#C9A84C" />

          {/* Separador onda */}
          <div style={{ flexShrink:0, height:48, margin:'10px 0', position:'relative', borderRadius:10, overflow:'hidden', background:'rgba(0,0,0,0.3)', border:'1px solid rgba(201,168,76,0.08)' }}>
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'0 20px' }}>
              {Array.from({ length:50 }).map((_,i) => {
                const a = ['wv1','wv2','wv3','wv4','wv5','wv6','wv7','wv8'][i%8];
                const mid = i>15 && i<35;
                return <div key={i} style={{ width:4, borderRadius:2, background:mid?'#C9A84C':'rgba(201,168,76,0.25)', animation:`${a} ${(1.1+(i%6)*0.18).toFixed(2)}s ease-in-out ${(i*0.06).toFixed(2)}s infinite`, boxShadow:mid?'0 0 5px rgba(201,168,76,0.45)':'none', alignSelf:'center' }} />;
              })}
            </div>
          </div>

          <SlideSection label="TIENDA DE ROPA" emoji="👕" pair={rPair} phase={rPhase} accentColor="#A89060" />
        </div>
      </div>

      {/* ══ FOOTER ══ */}
      <div style={{ position:'relative', zIndex:1, height:40, background:'#060606', borderTop:'1px solid rgba(201,168,76,0.12)', display:'flex', alignItems:'center', padding:'0 40px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#2ECC71', animation:'livePulse 2s ease-in-out infinite' }} />
          <span style={{ fontFamily:'Barlow Condensed', fontSize:11, color:'rgba(255,255,255,0.25)', letterSpacing:4 }}>EN VIVO</span>
        </div>
        <div style={{ fontFamily:'Barlow Condensed', fontSize:11, color:'rgba(255,255,255,0.2)', letterSpacing:3, textTransform:'uppercase' }}>
          {settings.business_name || 'FRESH CUTS'} · {settings.business_address || 'SANTIAGO, CHILE'}
        </div>
      </div>
    </div>
  );
}
