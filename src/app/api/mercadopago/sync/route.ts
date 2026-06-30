import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { syncProSubscriptionForEmail } from '../../../../lib/mercadopago';

export const maxDuration = 30;

/** POST /api/mercadopago/sync — activa PRO si MP ya autorizó la suscripción (backup del webhook). */
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
    console.error('[MP sync]', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
