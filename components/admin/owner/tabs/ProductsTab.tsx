'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Product, Category } from '@/types';
import { formatPrice } from '@/lib/utils';
import { uploadImage } from '@/lib/cloudinary';

export default function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const emptyForm: { name: string; description: string; category_id: string; price: number; stock: number; badge: '' | 'new' | 'hot'; image_url: string; active: boolean } = { name: '', description: '', category_id: '', price: 0, stock: 0, badge: '', image_url: '', active: true };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('products').select('*, category:categories(*)').order('sort_order'),
      supabase.from('categories').select('*').order('sort_order'),
    ]);
    if (prods) setProducts(prods as Product[]);
    if (cats) setCategories(cats);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, description: p.description, category_id: p.category_id, price: p.price, stock: p.stock, badge: p.badge, image_url: p.image_url, active: p.active });
    setShowForm(true);
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(f => ({ ...f, image_url: url }));
    } catch { alert('Error subiendo imagen'); }
    setUploading(false);
  }

  async function save() {
    if (!form.name || !form.price) return;
    setLoading(true);
    if (editing) {
      await supabase.from('products').update(form).eq('id', editing.id);
    } else {
      await supabase.from('products').insert(form);
    }
    setLoading(false);
    setShowForm(false);
    loadData();
  }

  async function toggleActive(p: Product) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id);
    loadData();
  }

  async function deleteProduct(id: string) {
    if (!confirm('¿Eliminar producto?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadData();
  }

  // ── Gestión de categorías ──
  const [showCatForm, setShowCatForm] = useState(false);
  const [catName, setCatName] = useState('');
  const [catEmoji, setCatEmoji] = useState('🛍️');

  async function addCategory() {
    if (!catName) return;
    const slug = catName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await supabase.from('categories').insert({ name: catName, slug, emoji: catEmoji });
    setCatName(''); setCatEmoji('🛍️'); setShowCatForm(false);
    loadData();
  }

  async function deleteCategory(id: string) {
    if (!confirm('¿Eliminar categoría?')) return;
    await supabase.from('categories').delete().eq('id', id);
    loadData();
  }

  if (showForm) return (
    <div className="anim-fadeup">
      <button onClick={() => setShowForm(false)} style={{ color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>← Volver</button>
      <h2 className="fc-title" style={{ fontSize: 26, color: 'var(--gold)', marginBottom: 20 }}>
        {editing ? 'Editar producto' : 'Nuevo producto'}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Nombre *</label>
          <input className="fc-input" placeholder="Nombre del producto" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Descripción</label>
          <input className="fc-input" placeholder="Descripción breve" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Precio *</label>
            <input className="fc-input" type="number" placeholder="12990" value={form.price || ''} onChange={e => setForm(f => ({...f, price: Number(e.target.value)}))} />
          </div>
          <div>
            <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Stock</label>
            <input className="fc-input" type="number" placeholder="10" value={form.stock || ''} onChange={e => setForm(f => ({...f, stock: Number(e.target.value)}))} />
          </div>
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Categoría</label>
          <select className="fc-input" value={form.category_id} onChange={e => setForm(f => ({...f, category_id: e.target.value}))}>
            <option value="">Sin categoría</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Badge</label>
          <select className="fc-input" value={form.badge} onChange={e => setForm(f => ({...f, badge: e.target.value as any}))}>
            <option value="">Sin badge</option>
            <option value="new">✨ Nuevo</option>
            <option value="hot">🔥 Popular</option>
          </select>
        </div>
        <div>
          <label className="fc-label" style={{ fontSize: 11, color: 'var(--gray)', display: 'block', marginBottom: 6 }}>Foto</label>
          {form.image_url && <img src={form.image_url} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
          <input type="file" accept="image/*" onChange={handleImage} style={{ color: 'var(--gray)', fontSize: 13 }} />
          {uploading && <div style={{ color: 'var(--gold)', fontSize: 13, marginTop: 4 }}>Subiendo imagen...</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ color: 'var(--gray)', fontSize: 14 }}>Activo:</label>
          <button onClick={() => setForm(f => ({...f, active: !f.active}))}
            style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: form.active ? 'var(--gold)' : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 3, left: form.active ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
          </button>
        </div>
        <button className="fc-btn-gold" disabled={loading || !form.name || !form.price} onClick={save} style={{ padding: 14 }}>
          {loading ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="fc-title" style={{ fontSize: 28, color: 'var(--gold)' }}>Productos</h2>
        <button className="fc-btn-gold" style={{ padding: '8px 16px', fontSize: 13 }} onClick={openNew}>+ Nuevo</button>
      </div>

      {/* Categorías */}
      <div className="fc-card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="fc-label" style={{ fontSize: 11, color: 'var(--gray)' }}>Categorías</span>
          <button onClick={() => setShowCatForm(!showCatForm)} style={{ background: 'none', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontSize: 13 }}>
            {showCatForm ? '✕' : '+ Agregar'}
          </button>
        </div>
        {showCatForm && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="fc-input" placeholder="Emoji" value={catEmoji} onChange={e => setCatEmoji(e.target.value)} style={{ width: 60 }} />
            <input className="fc-input" placeholder="Nombre categoría" value={catName} onChange={e => setCatName(e.target.value)} />
            <button className="fc-btn-gold" onClick={addCategory} style={{ padding: '0 16px', flexShrink: 0 }}>OK</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 20, fontSize: 13 }}>
              <span>{c.emoji} {c.name}</span>
              <button onClick={() => deleteCategory(c.id)} style={{ background: 'none', border: 'none', color: '#E74C3C', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de productos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {products.map(p => (
          <div key={p.id} className="fc-card" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14, opacity: p.active ? 1 : 0.5 }}>
            <div style={{ width: 56, height: 56, borderRadius: 8, background: p.image_url ? `url(${p.image_url}) center/cover` : 'rgba(201,168,76,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              {!p.image_url && '🛍️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ color: 'var(--gold)', fontSize: 14 }}>{formatPrice(p.price)} · Stock: {p.stock}</div>
              {!p.active && <div style={{ color: 'var(--gray)', fontSize: 11 }}>Oculto del catálogo</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => openEdit(p)} style={{ background: 'rgba(201,168,76,0.1)', border: 'none', color: 'var(--gold)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>Editar</button>
              <button onClick={() => toggleActive(p)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--gray)', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                {p.active ? 'Ocultar' : 'Mostrar'}
              </button>
              <button onClick={() => deleteProduct(p.id)} style={{ background: 'rgba(231,76,60,0.1)', border: 'none', color: '#E74C3C', padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
