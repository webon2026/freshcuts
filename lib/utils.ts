import { AdminSession } from '@/types';

const SESSION_KEY = 'freshcuts_session';

export function getSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(session: AdminSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function isOwner(): boolean {
  return getSession()?.role === 'owner';
}

export function isBarber(): boolean {
  const s = getSession();
  return s?.role === 'barber' || s?.role === 'owner';
}

// Formato de precio chileno
export function formatPrice(price: number): string {
  return `$${price.toLocaleString('es-CL')}`;
}

// Formato de hora legible
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

// Formato fecha legible
export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Status labels
export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendiente',    color: 'text-yellow-400 bg-yellow-400/10' },
  confirmed:   { label: 'Confirmada',   color: 'text-blue-400 bg-blue-400/10' },
  in_progress: { label: 'En atención',  color: 'text-green-400 bg-green-400/10' },
  done:        { label: 'Atendido',     color: 'text-gray-400 bg-gray-400/10' },
  cancelled:   { label: 'Cancelada',    color: 'text-red-400 bg-red-400/10' },
};

export const BARBER_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  available: { label: 'Disponible',  color: 'text-green-400',  bg: 'bg-green-400/10' },
  busy:      { label: 'En atención', color: 'text-red-400',    bg: 'bg-red-400/10' },
  break:     { label: 'Descanso',    color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  off:       { label: 'No disponible', color: 'text-gray-400', bg: 'bg-gray-400/10' },
};
