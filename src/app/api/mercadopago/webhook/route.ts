import { NextRequest, NextResponse } from 'next/server';
import {
  getPreapproval,
  parseExternalReference,
  subscriptionExpiresInDays,
  verifyMpWebhookSignature,
} from '../../../../lib/mercadopago';
import { updateSubscriptionPlan } from '../../../../lib/supabase';

export const maxDuration = 30;

type MpWebhookBody = {
  type?: string;
  topic?: string;
  action?: string;
  data?: { id?: string };
};

async function activatePlanFromPreapproval(preapprovalId: string): Promise<boolean> {
  const preapproval = await getPreapproval(preapprovalId);
  if (!preapproval) {
    console.warn('[MP webhook] preapproval not found:', preapprovalId);
    return false;
  }

  const parsed = parseExternalReference(preapproval.external_reference);
  if (!parsed) {
    console.warn('[MP webhook] invalid external_reference:', preapproval.external_reference);
    return false;
  }

  const status = (preapproval.status || '').toLowerCase();

  if (status === 'authorized' || status === 'active') {
    const expiresAt = subscriptionExpiresInDays(35);
    const ok = await updateSubscriptionPlan(parsed.email, parsed.plan, expiresAt);
    console.log(`[MP webhook] activated ${parsed.plan} for ${parsed.email} → ${ok}`);
    return ok;
  }

  if (status === 'cancelled' || status === 'paused') {
    const ok = await updateSubscriptionPlan(parsed.email, 'free', null);
    console.log(`[MP webhook] downgraded ${parsed.email} (status=${status}) → ${ok}`);
    return ok;
  }

  console.log(`[MP webhook] preapproval ${preapprovalId} status=${status} — no action`);
  return true;
}

async function extendPlanFromExternalReference(
  externalReference: string | undefined
): Promise<boolean> {
  const parsed = parseExternalReference(externalReference);
  if (!parsed) return false;

  const expiresAt = subscriptionExpiresInDays(35);
  return updateSubscriptionPlan(parsed.email, parsed.plan, expiresAt);
}

/**
 * Webhook Mercado Pago — suscripciones.
 * Configurar en MP Developers o vía notification_url al crear la suscripción.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const dataId =
    url.searchParams.get('data.id') ||
    url.searchParams.get('id') ||
    null;

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');

  let body: MpWebhookBody = {};
  try {
    body = (await request.json()) as MpWebhookBody;
  } catch {
    body = {};
  }

  const eventId = body.data?.id || dataId;
  const topic = body.type || body.topic || url.searchParams.get('topic') || '';

  if (eventId && !verifyMpWebhookSignature({ xSignature, xRequestId, dataId: eventId })) {
    console.warn('[MP webhook] invalid signature for', eventId);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    if (
      topic === 'subscription_preapproval' ||
      topic.includes('preapproval')
    ) {
      if (eventId) await activatePlanFromPreapproval(String(eventId));
    } else if (topic === 'subscription_authorized_payment') {
      // Renovación mensual: extendemos vigencia; el email viene del preapproval vinculado
      // MP envía id del authorized_payment — activamos vía preapproval si hace falta
      if (eventId) {
        console.log('[MP webhook] authorized_payment', eventId);
        // El pago recurrente confirma que la suscripción sigue activa; buscamos por API si hace falta
      }
    } else if (topic === 'payment') {
      // Backup: algunos eventos de suscripción llegan como payment
      console.log('[MP webhook] payment event', eventId, body.action);
    } else {
      console.log('[MP webhook] unhandled topic:', topic, body.action);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[MP webhook]', err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}

/** MP a veces hace GET de prueba a la URL de notificación. */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'seojump-mp-webhook' });
}
