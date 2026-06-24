import { NextResponse } from 'next/server';
import { getMobbexAccountHealth } from '../../../lib/mobbex';

export const dynamic = 'force-dynamic';

/** GET /api/debug-mobbex — health check de credenciales y plan PRO. */
export async function GET() {
  const health = await getMobbexAccountHealth();
  return NextResponse.json(health, { status: health.ok ? 200 : 502 });
}
