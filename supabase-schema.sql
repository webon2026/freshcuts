-- =============================================
-- FRESH CUTS — Schema Supabase
-- Ejecutar en SQL Editor de Supabase
-- =============================================

-- ─── EXTENSIONES ───
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TABLA: Configuración del negocio ───
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: Barberos ───
CREATE TABLE IF NOT EXISTS barbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'barber' CHECK (role IN ('owner', 'barber')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'busy', 'break', 'off')),
  email TEXT UNIQUE,
  avatar_emoji TEXT DEFAULT '✂️',
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: Servicios ───
CREATE TABLE IF NOT EXISTS services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: Horarios disponibles ───
CREATE TABLE IF NOT EXISTS time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dom, 1=Lun...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

-- ─── TABLA: Citas ───
CREATE TABLE IF NOT EXISTS appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'done', 'cancelled')),
  notes TEXT DEFAULT '',
  total_price INTEGER DEFAULT 0,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: Categorías de productos ───
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '🛍️',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TABLA: Productos ───
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  price INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  badge TEXT DEFAULT '' CHECK (badge IN ('', 'new', 'hot')),
  image_url TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÍNDICES ───
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_barber ON appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- ─── ROW LEVEL SECURITY ───
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Lectura pública (para el sitio web de clientes)
CREATE POLICY "settings_public_read" ON settings FOR SELECT USING (TRUE);
CREATE POLICY "barbers_public_read" ON barbers FOR SELECT USING (active = TRUE);
CREATE POLICY "services_public_read" ON services FOR SELECT USING (active = TRUE);
CREATE POLICY "slots_public_read" ON time_slots FOR SELECT USING (active = TRUE);
CREATE POLICY "appointments_public_insert" ON appointments FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "categories_public_read" ON categories FOR SELECT USING (TRUE);
CREATE POLICY "products_public_read" ON products FOR SELECT USING (active = TRUE);

-- Admin total (service_role — usado desde API routes de Next.js)
CREATE POLICY "settings_admin" ON settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "barbers_admin" ON barbers FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "services_admin" ON services FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "slots_admin" ON time_slots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "appointments_admin" ON appointments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "categories_admin" ON categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "products_admin" ON products FOR ALL USING (auth.role() = 'service_role');

-- ─── REALTIME ───
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE barbers;
ALTER PUBLICATION supabase_realtime ADD TABLE products;

-- =============================================
-- DATOS INICIALES
-- =============================================

-- Configuración
INSERT INTO settings (key, value) VALUES
  ('business_name', 'Salón Fresh Cuts'),
  ('business_phone', '+56998811877'),
  ('owner_phone', '+56998811877'),
  ('whatsapp_number', '56998811877'),
  ('business_address', 'Santiago, Chile'),
  ('business_hours', '10:00 - 20:00'),
  ('booking_advance_days', '7'),
  ('reminder_hours_before', '1')
ON CONFLICT (key) DO NOTHING;

-- Barberos (contraseñas se configuran via Supabase Auth)
INSERT INTO barbers (name, phone, role, status, email, avatar_emoji, sort_order) VALUES
  ('Charles', '+56998811877', 'owner', 'available', 'charles@freshcuts.cl', '👑', 0),
  ('Barbero 2', '', 'barber', 'available', 'barbero2@freshcuts.cl', '✂️', 1),
  ('Barbero 3', '', 'barber', 'available', 'barbero3@freshcuts.cl', '✂️', 2),
  ('Barbero 4', '', 'barber', 'available', 'barbero4@freshcuts.cl', '✂️', 3)
ON CONFLICT DO NOTHING;

-- Servicios
INSERT INTO services (name, description, price, duration_minutes, sort_order) VALUES
  ('Corte Clásico', 'Corte a tijera o máquina', 8000, 30, 0),
  ('Corte + Degradado', 'Corte con fade o degradado', 12000, 45, 1),
  ('Barba', 'Perfilado y arreglo de barba', 7000, 20, 2),
  ('Combo Completo', 'Corte + barba + degradado', 18000, 60, 3),
  ('Diseño', 'Diseño y detalle con navaja', 5000, 20, 4)
ON CONFLICT DO NOTHING;

-- Categorías
INSERT INTO categories (name, slug, emoji, sort_order) VALUES
  ('Pomadas & Ceras', 'pomadas', '💈', 0),
  ('Cuidado de Barba', 'barba', '🧔', 1),
  ('Ropa', 'ropa', '👕', 2),
  ('Accesorios', 'accesorios', '🎒', 3)
ON CONFLICT (slug) DO NOTHING;

-- Productos de ejemplo
INSERT INTO products (name, description, price, stock, badge,
  category_id)
SELECT 'Pomada Mate Premium', 'Fijación fuerte, acabado mate', 12990, 10, 'hot', id
FROM categories WHERE slug = 'pomadas'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price, stock, badge, category_id)
SELECT 'Aceite para Barba', 'Hidrata y acondiciona, aroma cedro', 9990, 8, 'new', id
FROM categories WHERE slug = 'barba'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, description, price, stock, badge, category_id)
SELECT 'Camiseta Fresh Cuts', '100% algodón premium, tallas S-XL', 19990, 15, '', id
FROM categories WHERE slug = 'ropa'
ON CONFLICT DO NOTHING;
