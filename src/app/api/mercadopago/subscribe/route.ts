import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createProSubscriptionCheckout } from '../../../../lib/mercadopago';
import { getUserPlanSnapshot } from '../../../../lib/aiCredits';

export const maxDuration = 30;

/**
 * POST /api/mercadopago/subscribe
 * Usuario logueado → crea suscripción PRO en MP → devuelve init_point (URL checkout).
 */
export async function POST() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión primero.' }, { status: 401 });
  }

  try {
    const snapshot = await getUserPlanSnapshot(email);
    if (snapshot.hasPremiumAccess && snapshot.plan !== 'free') {
      return NextResponse.json(
        { error: 'Ya tenés un plan activo.', plan: snapshot.plan },
        { status: 400 }
      );
    }

    const checkout = await createProSubscriptionCheckout({ payerEmail: email });
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
