import { NextResponse } from 'next/server';
import { handleMobbexWebhook } from '../../../../lib/mobbex';

export const maxDuration = 30;

/** Webhook Mobbex — ejecuciones de suscripción y checkout. */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  try {
    await handleMobbexWebhook(body);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    console.error('[Mobbex webhook]', err);
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'seojump-mobbex-webhook' });
}
