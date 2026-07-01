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
    let status = preapprovalId
      ? await syncProSubscriptionByPreapprovalId(preapprovalId, email)
      : await syncProSubscriptionForEmail(email);

    // Si el ID guardado en el navegador es viejo o incorrecto, buscar por email
    if (preapprovalId && (status === 'none' || status === 'error')) {
      const fallback = await syncProSubscriptionForEmail(email);
      if (fallback === 'activated' || fallback === 'pending') {
        status = fallback;
      } else if (status === 'none' && fallback !== 'none') {
        status = fallback;
      }
    }

    return NextResponse.json({ status });
  } catch (err) {
    console.error('[MP sync]', err);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
