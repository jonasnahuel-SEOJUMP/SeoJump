import { NextRequest, NextResponse } from 'next/server';
import {
  getPreapproval,
  activateProFromPreapproval,
  activateProFromAuthorizedPayment,
  parseExternalReference,
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

type WebhookOutcome = 'activated' | 'pending' | 'none' | 'error' | 'downgraded';

async function activatePlanFromPreapproval(preapprovalId: string): Promise<WebhookOutcome> {
  const preapproval = await getPreapproval(preapprovalId);
  if (!preapproval) {
    console.warn('[MP webhook] preapproval not found:', preapprovalId);
    return 'none';
  }

  const parsed = parseExternalReference(preapproval.external_reference);
  if (!parsed) {
    console.warn('[MP webhook] invalid external_reference:', preapproval.external_reference);
    return 'none';
  }

  const status = (preapproval.status || '').toLowerCase();

  if (status === 'cancelled' || status === 'paused') {
    const result = await updateSubscriptionPlan(parsed.email, 'free', null);
    console.log(`[MP webhook] downgraded ${parsed.email} (status=${status}) → ${result.ok}`);
    return result.ok ? 'downgraded' : 'error';
  }

  const outcome = await activateProFromPreapproval(preapproval);
  console.log(
    `[MP webhook] preapproval ${preapprovalId} status=${status} → ${outcome} for ${parsed.email}`
  );
  return outcome;
}

function isProcessingFailure(outcome: WebhookOutcome): boolean {
  return outcome === 'error';
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
    console.warn('[MP webhook] invalid or missing signature for', eventId);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let processingError = false;

  try {
    if (
      topic === 'subscription_preapproval' ||
      topic.includes('preapproval')
    ) {
      if (eventId) {
        const outcome = await activatePlanFromPreapproval(String(eventId));
        if (isProcessingFailure(outcome)) processingError = true;
      }
    } else if (topic === 'subscription_authorized_payment') {
      if (eventId) {
        const outcome = await activateProFromAuthorizedPayment(String(eventId));
        console.log(`[MP webhook] authorized_payment ${eventId} → ${outcome}`);
        if (isProcessingFailure(outcome)) processingError = true;
      }
    } else if (topic === 'payment') {
      console.log('[MP webhook] payment event', eventId, body.action);
    } else {
      console.log('[MP webhook] unhandled topic:', topic, body.action);
    }

    if (processingError) {
      return NextResponse.json({ error: 'Activation failed, retry later' }, { status: 500 });
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
