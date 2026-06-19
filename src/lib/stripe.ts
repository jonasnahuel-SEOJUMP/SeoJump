/**
 * src/lib/stripe.ts
 *
 * Helpers de Stripe para SEO Jump.
 * Solo se usa en server-side (Route Handlers / Server Actions).
 * ⚠️ NUNCA importar desde componentes "use client".
 *
 * Variables de entorno necesarias:
 *   STRIPE_SECRET_KEY        → sk_live_... (o sk_test_... en dev)
 *   STRIPE_WEBHOOK_SECRET    → whsec_...
 *   STRIPE_PRO_PRICE_ID      → price_... (precio mensual PRO en Stripe)
 *   NEXT_PUBLIC_APP_URL      → https://seo-jump.ai (para redirect URLs)
 */

import Stripe from 'stripe';

// ─── Cliente ─────────────────────────────────────────────────────────────────

const secretKey = process.env.STRIPE_SECRET_KEY;

export const stripe: Stripe | null = secretKey
  ? new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' })
  : null;

// ─── Constantes ──────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://seo-jump.ai';

/** Price ID del plan PRO mensual creado en el Dashboard de Stripe. */
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea una Stripe Checkout Session para el plan PRO (suscripción mensual).
 * Devuelve la URL de checkout o un error.
 *
 * @param accountEmail  Email de la cuenta SEO Jump (identificador del usuario)
 */
export async function createStripeProCheckout(accountEmail: string): Promise<
  { url: string; sessionId: string } | { error: string }
> {
  if (!stripe) {
    return { error: 'Stripe no está configurado en el servidor.' };
  }
  if (!PRO_PRICE_ID) {
    return { error: 'STRIPE_PRO_PRICE_ID no configurado.' };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      // Guardamos el email de la cuenta SEO Jump para activar el plan en el webhook
      client_reference_id: accountEmail,
      customer_email: accountEmail,
      metadata: { plan: 'pro', accountEmail },
      success_url: `${APP_URL}/precios?stripe=success`,
      cancel_url: `${APP_URL}/precios?stripe=cancel`,
      subscription_data: {
        metadata: { plan: 'pro', accountEmail },
      },
    });

    if (!session.url) {
      return { error: 'Stripe no devolvió URL de checkout.' };
    }

    return { url: session.url, sessionId: session.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Stripe] createStripeProCheckout:', msg);
    return { error: msg };
  }
}

/**
 * Verifica la firma del webhook de Stripe.
 * Devuelve el evento Stripe si la firma es válida, o null si no.
 */
export function constructStripeEvent(
  rawBody: Buffer | string,
  signature: string
): Stripe.Event | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) return null;

  try {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[Stripe] constructStripeEvent — firma inválida:', err);
    return null;
  }
}

/**
 * Calcula fecha de expiración N días en el futuro (ISO string).
 * Se usa para marcar la suscripción como activa por X días extra de gracia.
 */
export function stripeExpiresInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Extrae el email de la cuenta SEO Jump desde un evento Stripe.
 * Busca en metadata, client_reference_id y customer_email (en ese orden).
 */
export function extractEmailFromStripeEvent(
  obj: Stripe.Checkout.Session | Stripe.Subscription
): string | null {
  // Metadata del objeto (subscription o session)
  const metaEmail = obj.metadata?.accountEmail?.trim().toLowerCase();
  if (metaEmail) return metaEmail;

  // client_reference_id (solo en Session)
  if ('client_reference_id' in obj && obj.client_reference_id) {
    return obj.client_reference_id.trim().toLowerCase();
  }

  // customer_email (solo en Session)
  if ('customer_email' in obj && obj.customer_email) {
    return obj.customer_email.trim().toLowerCase();
  }

  return null;
}
