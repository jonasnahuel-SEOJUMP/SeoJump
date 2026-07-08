import { NextRequest, NextResponse } from 'next/server';
import {
  extractEmailFromLemonPayload,
  isLemonSubscriptionActive,
  lemonExpiresAtFromSubscription,
  lemonExpiresInDays,
  verifyLemonWebhookSignature,
  type LemonWebhookPayload,
} from '../../../../lib/lemonSqueezy';
import { updateSubscriptionPlan } from '../../../../lib/supabase';

export const maxDuration = 30;

/**
 * Webhook de Lemon Squeezy — gestión de suscripciones PRO.
 *
 * Eventos manejados:
 *   subscription_created          → activa PRO
 *   subscription_updated          → sincroniza estado
 *   subscription_resumed          → activa PRO
 *   subscription_payment_success    → renueva PRO
 *   subscription_cancelled          → mantiene PRO hasta ends_at (grace)
 *   subscription_expired            → baja a free
 *   subscription_payment_failed     → log (Lemon reintenta / dunning)
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-signature') ?? '';
  const eventName = request.headers.get('x-event-name') ?? '';

  if (!verifyLemonWebhookSignature(rawBody, signature)) {
    console.warn('[Lemon webhook] firma inválida o webhook secret no configurado');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: LemonWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LemonWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const resolvedEvent = eventName || payload.meta?.event_name || 'unknown';
  let processingError = false;

  try {
    const email = extractEmailFromLemonPayload(payload);
    const attrs = payload.data?.attributes ?? {};

    switch (resolvedEvent) {
      case 'subscription_created':
      case 'subscription_resumed': {
        if (!email) {
          console.warn(`[Lemon webhook] ${resolvedEvent}: sin email`);
          break;
        }
        const expiresAt = lemonExpiresAtFromSubscription(attrs);
        const result = await updateSubscriptionPlan(email, 'pro', expiresAt);
        console.log(`[Lemon webhook] PRO activado para ${email} (${resolvedEvent}) → ${result.ok}`);
        if (!result.ok) processingError = true;
        break;
      }

      case 'subscription_payment_success': {
        if (!email) {
          console.warn('[Lemon webhook] subscription_payment_success: sin email');
          break;
        }
        const expiresAt = lemonExpiresAtFromSubscription(attrs);
        const result = await updateSubscriptionPlan(email, 'pro', expiresAt);
        console.log(`[Lemon webhook] PRO renovado para ${email} → ${result.ok}`);
        if (!result.ok) processingError = true;
        break;
      }

      case 'subscription_updated': {
        if (!email) break;

        const status = attrs.status;
        if (isLemonSubscriptionActive(status)) {
          const expiresAt = lemonExpiresAtFromSubscription(attrs);
          const result = await updateSubscriptionPlan(email, 'pro', expiresAt);
          console.log(
            `[Lemon webhook] suscripción sincronizada para ${email} (status=${status}) → ${result.ok}`
          );
          if (!result.ok) processingError = true;
        } else if (status === 'expired' || status === 'unpaid') {
          const result = await updateSubscriptionPlan(email, 'free', null);
          console.log(`[Lemon webhook] plan → free para ${email} (status=${status}) → ${result.ok}`);
          if (!result.ok) processingError = true;
        }
        break;
      }

      case 'subscription_cancelled': {
        if (!email) break;
        // Grace period: sigue PRO hasta ends_at
        const expiresAt =
          typeof attrs.ends_at === 'string' && attrs.ends_at
            ? attrs.ends_at
            : lemonExpiresInDays(35);
        const result = await updateSubscriptionPlan(email, 'pro', expiresAt);
        console.log(`[Lemon webhook] cancelación con grace para ${email} → ${result.ok}`);
        if (!result.ok) processingError = true;
        break;
      }

      case 'subscription_expired': {
        if (!email) break;
        const result = await updateSubscriptionPlan(email, 'free', null);
        console.log(`[Lemon webhook] plan → free para ${email} (expired) → ${result.ok}`);
        if (!result.ok) processingError = true;
        break;
      }

      case 'subscription_payment_failed': {
        console.warn('[Lemon webhook] pago fallido, evento:', resolvedEvent);
        break;
      }

      default:
        console.log(`[Lemon webhook] evento no manejado: ${resolvedEvent}`);
    }

    if (processingError) {
      return NextResponse.json(
        { error: 'Activation failed, retry later' },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Lemon webhook] error al procesar evento:', err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}
