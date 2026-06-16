import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/geo
 * Devuelve el país del request usando el header de Vercel (x-vercel-ip-country).
 * En desarrollo local devuelve "AR" por defecto.
 */
export async function GET(request: NextRequest) {
  const country =
    request.headers.get('x-vercel-ip-country') ??
    process.env.DEFAULT_COUNTRY ??
    'AR';

  return NextResponse.json({ country: country.toUpperCase() });
}
