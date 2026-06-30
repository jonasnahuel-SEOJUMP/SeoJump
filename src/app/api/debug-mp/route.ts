import { NextResponse } from 'next/server';
import { getMpAccountHealth } from '../../../lib/mercadopago';

export const maxDuration = 15;

/** GET /api/debug-mp — health check de credenciales Mercado Pago (admin/dev). */
export async function GET() {
  const health = await getMpAccountHealth();
  return NextResponse.json(health);
}
