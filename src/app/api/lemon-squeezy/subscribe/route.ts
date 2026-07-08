import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { createLemonProCheckout } from '../../../../lib/lemonSqueezy';
import { getUserPlanSnapshot } from '../../../../lib/aiCredits';

export const maxDuration = 30;

/**
 * POST /api/lemon-squeezy/subscribe
 * Usuario logueado → crea Lemon Squeezy Checkout → devuelve URL de checkout.
 */
export async function POST() {
  const session = await auth();
  const accountEmail = session?.user?.email?.trim().toLowerCase();

  if (!accountEmail) {
    return NextResponse.json(
      { error: 'Tenés que iniciar sesión primero.' },
      { status: 401 }
    );
  }

  try {
    const snapshot = await getUserPlanSnapshot(accountEmail);
    if (snapshot.hasPremiumAccess && snapshot.plan !== 'free') {
      return NextResponse.json(
        { error: 'Ya tenés un plan activo.', plan: snapshot.plan },
        { status: 400 }
      );
    }

    const result = await createLemonProCheckout(accountEmail);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ url: result.url, checkoutId: result.checkoutId });
  } catch (err) {
    console.error('[Lemon subscribe]', err);
    return NextResponse.json(
      { error: 'Error interno al iniciar el pago.' },
      { status: 500 }
    );
  }
}
