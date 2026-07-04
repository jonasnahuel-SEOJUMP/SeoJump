import { NextResponse } from 'next/server';
import { getMpAccountHealth } from '../../../lib/mercadopago';
import { requireAdmin } from '../../../lib/adminGuard';

export const maxDuration = 15;

/** GET /api/debug-mp — health check de credenciales Mercado Pago (solo admin). */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const health = await getMpAccountHealth();
  return NextResponse.json(health);
}
