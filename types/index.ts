// ─── ROLES ───
export type UserRole = 'owner' | 'barber';

// ─── BARBERO ───
export interface Barber {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  status: 'available' | 'busy' | 'break' | 'off';
  username: string;
  avatar_emoji: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

// ─── SERVICIO ───
export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
}

// ─── CITA ───
export type AppointmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';

export interface Appointment {
  id: string;
  barber_id: string;
  service_id: string;
  client_name: string;
  client_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: AppointmentStatus;
  notes: string;
  total_price: number;
  reminder_sent: boolean;
  created_at: string;
  barber?: Barber;
  service?: Service;
}

// ─── CATEGORÍA ───
export interface Category {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  sort_order: number;
}

// ─── PRODUCTO ───
export interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  price: number;
  stock: number;
  badge: '' | 'new' | 'hot';
  image_url: string;
  active: boolean;
  sort_order: number;
  category?: Category;
}

// ─── SETTINGS ───
export interface Setting {
  key: string;
  value: string;
}

export interface BusinessSettings {
  business_name: string;
  business_phone: string;
  owner_phone: string;
  whatsapp_number: string;
  business_address: string;
  business_hours: string;
  booking_advance_days: string;
  reminder_hours_before: string;
}

// ─── CARRITO ───
export interface CartItem {
  product: Product;
  quantity: number;
}

// ─── SESSION ADMIN ───
export interface AdminSession {
  barber_id: string;
  name: string;
  role: UserRole;
  username: string;
}
