import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import {
  constructStripeEvent,
  extractEmailFromStripeEvent,
  stripeExpiresInDays,
} from '../../../../lib/stripe';
import { updateSubscriptionPlan } from '../../../../lib/supabase';

export const maxDuration = 30;

/**
 * Webhook de Stripe — gestión de suscripciones PRO.
 *
 * Eventos manejados:
 *   checkout.session.completed        → activa plan PRO
 *   customer.subscription.deleted     → baja a free
 *   customer.subscription.updated     → sincroniza estado (cancelled/active)
 *   invoice.payment_failed            → log (sin acción; Stripe reintenta)
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  const event = constructStripeEvent(rawBody, signature);

  if (!event) {
    console.warn('[Stripe webhook] firma inválida o webhook secret no configurado');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription') break;

        const email = extractEmailFromStripeEvent(session);
        if (!email) {
          console.warn('[Stripe webhook] checkout.session.completed: sin email', session.id);
          break;
        }

        const expiresAt = stripeExpiresInDays(35);
        const result = await updateSubscriptionPlan(email, 'pro', expiresAt);
        console.log(`[Stripe webhook] PRO activado para ${email} → ${result.ok}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const email = extractEmailFromStripeEvent(sub);
        if (!email) {
          console.warn('[Stripe webhook] subscription.deleted: sin email', sub.id);
          break;
        }

        const result = await updateSubscriptionPlan(email, 'free', null);
        console.log(`[Stripe webhook] plan → free para ${email} (cancelación) → ${result.ok}`);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const email = extractEmailFromStripeEvent(sub);
        if (!email) break;

        if (sub.status === 'active') {
          const expiresAt = stripeExpiresInDays(35);
          await updateSubscriptionPlan(email, 'pro', expiresAt);
          console.log(`[Stripe webhook] suscripción renovada para ${email}`);
        } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
          await updateSubscriptionPlan(email, 'free', null);
          console.log(`[Stripe webhook] plan → free para ${email} (status=${sub.status})`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('[Stripe webhook] pago fallido, factura:', invoice.id);
        // Stripe reintenta automáticamente. Sin acción por ahora.
        break;
      }

      default:
        console.log(`[Stripe webhook] evento no manejado: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Stripe webhook] error al procesar evento:', err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}
