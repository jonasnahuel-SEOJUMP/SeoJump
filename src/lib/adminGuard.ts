import { NextResponse } from 'next/server';
import { auth } from '../auth';

/**
 * True si el email está en ADMIN_EMAILS (o ALLOWED_EMAILS como fallback).
 * Si ninguna lista está configurada → todos son admin (modo desarrollo abierto).
 */
export function isAdminEmail(userEmail: string): boolean {
  const raw = process.env.ADMIN_EMAILS || process.env.ALLOWED_EMAILS || '';
  if (!raw.trim()) return true;
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(userEmail.trim().toLowerCase());
}

/**
 * Guard para rutas /api/debug-* y otros endpoints sensibles.
 * Devuelve { email } si el usuario tiene sesión y es admin, o una NextResponse
 * de error (401/403) que la ruta debe devolver tal cual.
 *
 * Uso:
 *   const guard = await requireAdmin();
 *   if (guard instanceof NextResponse) return guard;
 *   // guard.email disponible a partir de acá
 */
export async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }
  if (!isAdminEmail(email)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }
  return { email };
}
