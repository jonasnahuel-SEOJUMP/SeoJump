import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createProSubscriptionCheckout } from '../../../../lib/mercadopago';
import { getUserPlanSnapshot } from '../../../../lib/aiCredits';

export const maxDuration = 30;

/**
 * POST /api/mercadopago/subscribe
 * Usuario logueado → crea suscripción PRO en MP → devuelve init_point (URL checkout).
 */
export async function POST(request: Request) {
  const session = await auth();
  const accountEmail = session?.user?.email?.trim().toLowerCase();

  if (!accountEmail) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión primero.' }, { status: 401 });
  }

  let paymentEmail = accountEmail;
  try {
    const body = await request.json();
    if (body?.paymentEmail && typeof body.paymentEmail === 'string') {
      paymentEmail = body.paymentEmail.trim().toLowerCase();
    }
  } catch {
    /* body vacío → usar email de la sesión */
  }

  if (!paymentEmail.includes('@')) {
    return NextResponse.json({ error: 'Email de Mercado Pago inválido.' }, { status: 400 });
  }

  try {
    const snapshot = await getUserPlanSnapshot(accountEmail);
    if (snapshot.hasPremiumAccess && snapshot.plan !== 'free') {
      return NextResponse.json(
        { error: 'Ya tenés un plan activo.', plan: snapshot.plan },
        { status: 400 }
      );
    }

    const checkout = await createProSubscriptionCheckout({
      accountEmail,
      payerEmail: paymentEmail,
    });
    if ('error' in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 502 });
    }

    return NextResponse.json({
      initPoint: checkout.initPoint,
      preapprovalId: checkout.preapprovalId,
    });
  } catch (err) {
    console.error('[MP subscribe]', err);
    return NextResponse.json(
      { error: 'Error interno al iniciar el pago.' },
      { status: 500 }
    );
  }
}
