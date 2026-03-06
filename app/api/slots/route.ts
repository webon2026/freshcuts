import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get('barber_id');
  const date = searchParams.get('date');
  if (!barberId || !date) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

  const db = getSupabaseAdmin();

  const { data: barber } = await db.from('barbers').select('status, active').eq('id', barberId).single();
  if (!barber || !barber.active) return NextResponse.json({ slots: [], pending: [], booked: [], reason: 'barber_unavailable' });
  if (barber.status === 'off') return NextResponse.json({ slots: [], pending: [], booked: [], reason: 'barber_off' });

  const now = new Date();
  const chileNow = new Date(now.getTime() + (-3) * 3600000);
  const serverDate = chileNow.toISOString().slice(0, 10);
  const isToday = date === serverDate;
  if (date < serverDate) return NextResponse.json({ slots: [], pending: [], booked: [], reason: 'past_date' });

  const chileMinutes = chileNow.getUTCHours() * 60 + chileNow.getUTCMinutes();

  const allSlots: string[] = [];
  for (let h = 9; h < 20; h++) {
    for (const m of [0, 30]) {
      if (isToday && (h * 60 + m) <= chileMinutes + 30) continue;
      allSlots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    }
  }

  // Bloqueos
  const { data: blocks } = await db.from('barber_blocks').select('*').eq('barber_id', barberId).eq('block_date', date);
  const blockedSlots = new Set<string>();
  for (const block of blocks || []) {
    if (!block.start_time && !block.end_time) {
      allSlots.forEach(s => blockedSlots.add(s));
    } else {
      const bs = toMin(block.start_time), be = toMin(block.end_time);
      for (const slot of allSlots) {
        if (toMin(slot + ':00') >= bs && toMin(slot + ':00') < be) blockedSlots.add(slot);
      }
    }
  }

  // Citas — separar por estado
  const { data: appts } = await db
    .from('appointments').select('appointment_time, status')
    .eq('barber_id', barberId).eq('appointment_date', date)
    .in('status', ['pending', 'confirmed', 'in_progress']);

  const pendingTimes = new Set<string>();   // pending = alguien en proceso
  const confirmedTimes = new Set<string>(); // confirmed/in_progress = definitivamente ocupado

  for (const a of appts || []) {
    const t = a.appointment_time.slice(0, 5);
    if (a.status === 'pending') pendingTimes.add(t);
    else confirmedTimes.add(t);
  }

  // available = libre de todo
  // pending_slot = alguien está en proceso (mostrar aviso)
  // booked = confirmado/en atención (no mostrar)
  const available = allSlots.filter(s => !blockedSlots.has(s) && !pendingTimes.has(s) && !confirmedTimes.has(s));
  const pendingSlots = allSlots.filter(s => pendingTimes.has(s));

  return NextResponse.json(
    {
      slots: available,
      pending_slots: pendingSlots,   // slots en proceso de reserva
      booked: Array.from(confirmedTimes),
      blocked: Array.from(blockedSlots),
      server_date: serverDate,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}

function toMin(t: string): number {
  if (!t) return 0;
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}
