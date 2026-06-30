import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import {
  syncProSubscriptionForEmail,
  syncProSubscriptionByPreapprovalId,
} from '../../../../lib/mercadopago';

export const maxDuration = 30;

/** POST /api/mercadopago/sync — activa PRO si MP ya autorizó la suscripción (backup del webhook). */
export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let preapprovalId: string | undefined;
  try {
    const body = await request.json();
    if (body?.preapprovalId && typeof body.preapprovalId === 'string') {
      preapprovalId = body.preapprovalId.trim();
    }
  } catch {
    /* body vacío */
  }

  try {
    const status = preapprovalId
      ? await syncProSubscriptionByPreapprovalId(preapprovalId, email)
      : await syncProSubscriptionForEmail(email);
    return NextResponse.json({ status });
  } catch (err) {
    console.error('[MP sync]', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
