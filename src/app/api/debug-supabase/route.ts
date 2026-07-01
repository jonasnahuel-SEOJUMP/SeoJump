import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '../../../auth';

export const maxDuration = 15;

function isAdminEmail(userEmail: string): boolean {
  const raw = process.env.ADMIN_EMAILS || process.env.ALLOWED_EMAILS || '';
  if (!raw.trim()) return true;
  const list = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(userEmail.trim().toLowerCase());
}

/** GET /api/debug-supabase — health check Supabase (solo admin con sesión). */
export async function GET() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }
  if (!isAdminEmail(email)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  let projectHost: string | null = null;
  try {
    projectHost = url ? new URL(url).hostname : null;
  } catch {
    projectHost = null;
  }

  if (!url || !serviceKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      hasUrl: !!url,
      hasServiceKey: !!serviceKey,
      hasAnonKey: !!anonKey,
      projectHost,
      hint: 'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel (proyecto seojump).',
    });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { count, error } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return NextResponse.json({
        ok: false,
        configured: true,
        projectHost,
        hasAnonKey: !!anonKey,
        apiError: error.message,
        hint: 'La URL responde pero la API devolvió error. Revisá que las keys sean del mismo proyecto.',
      });
    }

    return NextResponse.json({
      ok: true,
      configured: true,
      projectHost,
      hasAnonKey: !!anonKey,
      profilesCount: count ?? 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      configured: true,
      projectHost,
      hasAnonKey: !!anonKey,
      error: message,
      hint:
        'Si dice fetch failed o ENOTFOUND, la URL en Vercel no coincide con Supabase → Settings → API → Project URL. Copiala de nuevo y redeploy.',
    });
  }
}
