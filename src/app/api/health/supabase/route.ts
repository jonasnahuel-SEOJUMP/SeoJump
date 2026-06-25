import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { getMissionsByEmail } from '../../../../lib/supabase';

/**
 * Diagnóstico rápido: ¿Supabase responde y hay misiones guardadas?
 * GET /api/health/supabase (requiere sesión)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !hasServiceKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: 'missing_env',
      hint: 'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.',
    });
  }

  try {
    const missions = await getMissionsByEmail(session.user.email, 'completed');
    return NextResponse.json({
      ok: true,
      configured: true,
      hasAnonKey,
      projectHost: new URL(url).hostname,
      completedMissions: missions.length,
      email: session.user.email,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      configured: true,
      projectHost: url ? new URL(url).hostname : null,
      error: 'connection_failed',
      message,
      hint: 'Si recibiste mail de Supabase sobre pausar el proyecto, entrá al dashboard y tocá «Restore project».',
    });
  }
}
