import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { syncProSubscriptionForEmail } from '../../../../lib/mobbex';

export const maxDuration = 30;

/** POST /api/mobbex/sync — activa PRO si Mobbex ya cobró (backup del webhook). */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const status = await syncProSubscriptionForEmail(email);
    return NextResponse.json({ status });
  } catch (err) {
    console.error('[Mobbex sync]', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
