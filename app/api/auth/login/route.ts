import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ ok: false, message: 'Faltan datos' }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const { data: barber } = await supabaseAdmin
    .from('barbers')
    .select('id, username, active')
    .eq('username', username.toLowerCase())
    .eq('active', true)
    .single();

  if (!barber) {
    return NextResponse.json({ ok: false, message: 'Usuario no encontrado' }, { status: 401 });
  }

  const { data: setting } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', `pwd_${barber.id}`)
    .single();

  if (!setting) {
    if (password !== 'freshcuts2026') {
      return NextResponse.json({ ok: false, message: 'Contraseña incorrecta' }, { status: 401 });
    }
  } else if (setting.value !== password) {
    return NextResponse.json({ ok: false, message: 'Contraseña incorrecta' }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
