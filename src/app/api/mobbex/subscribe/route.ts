import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createProSubscriptionCheckout } from '../../../../lib/mobbex';
import { getUserPlanSnapshot } from '../../../../lib/aiCredits';

export const maxDuration = 30;

/** POST /api/mobbex/subscribe — checkout suscripción PRO vía Mobbex. */
export async function POST() {
  const session = await auth();
  const accountEmail = session?.user?.email?.trim().toLowerCase();
  const customerName = session?.user?.name || undefined;

  if (!accountEmail) {
    return NextResponse.json({ error: 'Tenés que iniciar sesión primero.' }, { status: 401 });
  }

  try {
    const snapshot = await getUserPlanSnapshot(accountEmail);
    if (snapshot.hasPremiumAccess && snapshot.plan !== 'free') {
      return NextResponse.json(
        { error: 'Ya tenés un plan activo.', plan: snapshot.plan },
        { status: 400 }
      );
    }

    const checkout = await createProSubscriptionCheckout({ accountEmail, customerName });
    if ('error' in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 502 });
    }

    return NextResponse.json({
      checkoutUrl: checkout.checkoutUrl,
      subscriptionId: checkout.subscriptionId,
      subscriberId: checkout.subscriberId,
      stub: checkout.stub === true,
    });
  } catch (err) {
    console.error('[Mobbex subscribe]', err);
    return NextResponse.json({ error: 'Error interno al iniciar el pago.' }, { status: 500 });
  }
}
