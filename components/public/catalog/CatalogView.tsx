'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Category, CartItem } from '@/types';
import { formatPrice } from '@/lib/utils';

export default function CatalogView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [waNumber, setWaNumber] = useState('56998811877');

  const loadData = useCallback(async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').eq('active', true).order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    if (prods) setProducts(prods as Product[]);
    if (cats) setCategories(cats);
  }, []);

  async function loadSettings() {
    const { data } = await supabase.from('settings').select('key,value').eq('key','whatsapp_number');
    if (data?.[0]) setWaNumber(data[0].value);
  }

  // Ref para que el canal no capture loadData stale
  const loadDataRef = useRef(loadData);
  useEffect(() => { loadDataRef.current = loadData; }, [loadData]);

  useEffect(() => {
    loadData();
    loadSettings();
    // Canal con nombre único para evitar conflictos
    const channel = supabase.channel(`catalog-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' },   () => loadDataRef.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => loadDataRef.current())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = activeCategory === 'all'
    ? products
    : products.filter(p => p.category_id === activeCategory);

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) return prev.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.product.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i).filter(i => i.quantity > 0));
  }

  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  function sendWhatsApp() {
    const lines = cart.map(i => `• ${i.product.name} x${i.quantity} — ${formatPrice(i.product.price * i.quantity)}`).join('\n');
    const msg = encodeURIComponent(`🛍️ *Pedido — Fresh Cuts*\n\n${lines}\n\n*Total: ${formatPrice(total)}*`);
    window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
  }

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 20 }}>
        {[{ id: 'all', name: 'Todo', emoji: '✨' }, ...categories].map(c => (
          <button key={c.id} onClick={() => setActiveCategory(c.id)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: activeCategory === c.id ? 'var(--gold)' : 'var(--card)',
              color: activeCategory === c.id ? 'var(--black)' : 'var(--gray)',
              fontWeight: 600, fontSize: 13, transition: 'all 0.2s',
            }}
          >{'emoji' in c ? (c as any).emoji : ''} {c.name}</button>
        ))}
      </div>

      {/* Grid productos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {filtered.map(p => {
          const inCart = cart.find(i => i.product.id === p.id);
          return (
            <div key={p.id} className="fc-card" style={{ overflow: 'hidden', padding: 0 }}>
              {/* Imagen cuadrada proporcional */}
              <div style={{ width: '100%', paddingBottom: '100%', position: 'relative' }}>
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1e1e1e,#2a2a2a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                    🛍️
                  </div>
                )}
                {p.badge && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    background: p.badge === 'hot' ? '#C0392B' : 'var(--gold)',
                    color: p.badge === 'hot' ? 'white' : 'var(--black)',
                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                  }} className="fc-label">
                    {p.badge === 'hot' ? '🔥 Popular' : '✨ Nuevo'}
                  </div>
                )}
                {p.stock === 0 && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--gray)', fontWeight: 700, fontSize: 12 }} className="fc-label">Sin stock</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '12px 14px' }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{p.name}</div>
                {p.description && <div style={{ color: 'var(--gray)', fontSize: 12, marginBottom: 8, lineHeight: 1.3 }}>{p.description}</div>}
                <div className="fc-title" style={{ fontSize: 22, color: 'var(--gold)', marginBottom: 10 }}>{formatPrice(p.price)}</div>

                {p.stock > 0 && (
                  inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => updateQty(p.id, -1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: 18 }}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{inCart.quantity}</span>
                      <button onClick={() => updateQty(p.id, 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer', fontSize: 18 }}>+</button>
                    </div>
                  ) : (
                    <button className="fc-btn-gold" style={{ width: '100%', padding: '9px 0', fontSize: 13 }} onClick={() => addToCart(p)}>
                      + Agregar
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón carrito flotante */}
      {totalItems > 0 && !showCart && (
        <button onClick={() => setShowCart(true)} style={{
          position: 'fixed', bottom: 80, right: 20,
          background: 'var(--gold)', color: 'var(--black)',
          border: 'none', borderRadius: 50, width: 60, height: 60,
          fontSize: 24, cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(201,168,76,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          🛒
          <div style={{ position: 'absolute', top: -4, right: -4, background: 'var(--red)', color: 'white', borderRadius: '50%', width: 22, height: 22, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {totalItems}
          </div>
        </button>
      )}

      {/* Modal carrito */}
      {showCart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCart(false); }}>
          <div style={{ background: 'var(--dark)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 24, borderTop: '2px solid var(--gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="fc-title" style={{ fontSize: 24, color: 'var(--gold)' }}>Tu pedido</h3>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>
            {cart.map(i => (
              <div key={i.product.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{i.product.name}</div>
                  <div style={{ color: 'var(--gold)', fontSize: 14 }}>{formatPrice(i.product.price)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQty(i.product.id, -1)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer' }}>−</button>
                  <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{i.quantity}</span>
                  <button onClick={() => updateQty(i.product.id, 1)} style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(201,168,76,0.3)', background: 'transparent', color: 'var(--gold)', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{formatPrice(i.product.price * i.quantity)}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', marginTop: 4 }}>
              <span className="fc-label" style={{ fontSize: 14, color: 'var(--gray)' }}>Total</span>
              <span className="fc-title" style={{ fontSize: 26, color: 'var(--gold)' }}>{formatPrice(total)}</span>
            </div>
            <button className="fc-btn-gold" style={{ width: '100%', padding: 16, fontSize: 16 }} onClick={sendWhatsApp}>
              📲 Pedir por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
