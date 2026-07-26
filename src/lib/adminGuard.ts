import { NextResponse } from 'next/server';
import { auth } from '../auth';
import { isAdminEmail } from './adminEmails';

export { isAdminEmail };

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
