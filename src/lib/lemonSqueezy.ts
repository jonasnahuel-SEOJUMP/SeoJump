/**
 * src/lib/lemonSqueezy.ts
 *
 * Helpers de Lemon Squeezy para SEO Jump.
 * Solo server-side (Route Handlers). NUNCA importar desde "use client".
 *
 * Variables de entorno:
 *   LEMON_SQUEEZY_API_KEY
 *   LEMON_SQUEEZY_STORE_ID          → 419196
 *   LEMON_SQUEEZY_VARIANT_ID        → UUID del variant PRO
 *   LEMON_SQUEEZY_WEBHOOK_SECRET    → signing secret del webhook
 *   NEXT_PUBLIC_APP_URL
 */

import crypto from 'node:crypto';

const API_BASE = 'https://api.lemonsqueezy.com/v1';

const API_KEY = process.env.LEMON_SQUEEZY_API_KEY;
const STORE_ID = process.env.LEMON_SQUEEZY_STORE_ID ?? '419196';
const VARIANT_ID =
  process.env.LEMON_SQUEEZY_VARIANT_ID ?? '388eaeb7-d434-4443-803f-fbf0d59adde0';
const WEBHOOK_SECRET = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://seo-jump.ai';

const JSON_API_HEADERS = {
  Accept: 'application/vnd.api+json',
  'Content-Type': 'application/vnd.api+json',
} as const;

type LemonCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: { url?: string };
  };
  errors?: Array<{ detail?: string; title?: string }>;
};

export type LemonWebhookPayload = {
  meta?: {
    event_name?: string;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: string;
    attributes?: Record<string, unknown>;
  };
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'on_trial',
  'cancelled',
  'paused',
  'past_due',
]);

/**
 * Crea un checkout Lemon Squeezy para el plan PRO (suscripción mensual USD).
 */
export async function createLemonProCheckout(
  accountEmail: string
): Promise<{ url: string; checkoutId: string } | { error: string }> {
  if (!API_KEY) {
    return { error: 'Lemon Squeezy no está configurado en el servidor.' };
  }

  const testMode = process.env.LEMON_SQUEEZY_TEST_MODE === 'true';

  try {
    const res = await fetch(`${API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        ...JSON_API_HEADERS,
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            test_mode: testMode,
            product_options: {
              redirect_url: `${APP_URL}/precios?lemon=success`,
            },
            checkout_data: {
              email: accountEmail,
              custom: {
                accountEmail,
                plan: 'pro',
              },
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: String(STORE_ID) },
            },
            variant: {
              data: { type: 'variants', id: String(VARIANT_ID) },
            },
          },
        },
      }),
    });

    const json = (await res.json()) as LemonCheckoutResponse;

    if (!res.ok) {
      const detail =
        json.errors?.map((e) => e.detail || e.title).filter(Boolean).join('; ') ||
        `HTTP ${res.status}`;
      console.error('[Lemon] createLemonProCheckout:', detail);
      return { error: detail };
    }

    const url = json.data?.attributes?.url;
    const checkoutId = json.data?.id;

    if (!url || !checkoutId) {
      return { error: 'Lemon Squeezy no devolvió URL de checkout.' };
    }

    return { url, checkoutId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Lemon] createLemonProCheckout:', msg);
    return { error: msg };
  }
}

/** Verifica la firma HMAC del webhook (header X-Signature). */
export function verifyLemonWebhookSignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;

  try {
    const digest = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    const digestBuf = Buffer.from(digest, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');

    if (digestBuf.length !== sigBuf.length) return false;
    return crypto.timingSafeEqual(digestBuf, sigBuf);
  } catch (err) {
    console.error('[Lemon] verifyLemonWebhookSignature:', err);
    return false;
  }
}

export function lemonExpiresInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Extrae el email de la cuenta SEO Jump desde meta.custom_data o atributos del objeto. */
export function extractEmailFromLemonPayload(payload: LemonWebhookPayload): string | null {
  const custom = payload.meta?.custom_data;
  if (custom && typeof custom === 'object') {
    const fromCustom = custom.accountEmail ?? custom.account_email;
    if (typeof fromCustom === 'string' && fromCustom.includes('@')) {
      return fromCustom.trim().toLowerCase();
    }
  }

  const attrs = payload.data?.attributes;
  if (attrs) {
    const userEmail = attrs.user_email;
    if (typeof userEmail === 'string' && userEmail.includes('@')) {
      return userEmail.trim().toLowerCase();
    }
  }

  return null;
}

export function isLemonSubscriptionActive(status: unknown): boolean {
  return typeof status === 'string' && ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

/** Calcula subscription_expires_at según renews_at / ends_at de Lemon. */
export function lemonExpiresAtFromSubscription(attrs: Record<string, unknown>): string {
  const status = attrs.status;
  const endsAt = attrs.ends_at;
  const renewsAt = attrs.renews_at;

  if (status === 'cancelled' && typeof endsAt === 'string' && endsAt) {
    return endsAt;
  }

  if (typeof renewsAt === 'string' && renewsAt) {
    const d = new Date(renewsAt);
    d.setDate(d.getDate() + 5);
    return d.toISOString();
  }

  return lemonExpiresInDays(35);
}
