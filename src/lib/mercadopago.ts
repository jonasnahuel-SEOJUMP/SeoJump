/**
 * Mercado Pago — suscripciones recurrentes (API /preapproval).
 * Docs: https://www.mercadopago.com.ar/developers/es/docs/subscriptions/overview
 *
 * Usamos suscripción "pending": MP devuelve init_point y el usuario
 * completa el pago en el checkout de Mercado Pago (sin tokenizar tarjeta en nuestra web).
 */

import crypto from 'crypto';
import type { PlanId } from './planLimits';
import { PLANS } from './planLimits';
import { updateSubscriptionPlan } from './supabase';

const MP_API = 'https://api.mercadopago.com';

export type MpPreapproval = {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
  init_point?: string;
  next_payment_date?: string;
};

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    'https://seo-jump.ai';
  return raw.replace(/\/$/, '');
}

export function getMpAccessToken(): string | null {
  const token = process.env.MP_ACCESS_TOKEN?.trim();
  return token || null;
}

/** Referencia interna: seojump|pro|usuario@mail.com */
export function buildExternalReference(plan: PlanId, email: string): string {
  return `seojump|${plan}|${email.trim().toLowerCase()}`;
}

export function parseExternalReference(
  ref: string | undefined | null
): { plan: PlanId; email: string } | null {
  if (!ref) return null;
  const parts = ref.split('|');
  if (parts.length !== 3 || parts[0] !== 'seojump') return null;
  const plan = parts[1] as PlanId;
  const email = parts[2].trim().toLowerCase();
  if (!email || !['pro', 'agency'].includes(plan)) return null;
  return { plan, email };
}

export function subscriptionExpiresInDays(days = 35): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function mpFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const token = getMpAccessToken();
  if (!token) {
    return { ok: false, status: 500, data: null, error: 'MP_ACCESS_TOKEN no configurado' };
  }

  const res = await fetch(`${MP_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  let data: T | null = null;
  try {
    data = (await res.json()) as T;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const errBody = data as { message?: string; cause?: unknown } | null;
    const msg = errBody?.message || `Mercado Pago HTTP ${res.status}`;
    return { ok: false, status: res.status, data, error: msg };
  }

  return { ok: true, status: res.status, data };
}

/** Crea suscripción mensual PRO y devuelve URL de checkout (init_point). */
export async function createProSubscriptionCheckout(params: {
  /** Cuenta SEO Jump (Google) — activamos PRO acá vía external_reference */
  accountEmail: string;
  /** Email de la cuenta Mercado Pago que va a pagar (puede ser distinto) */
  payerEmail: string;
}): Promise<{ initPoint: string; preapprovalId: string } | { error: string }> {
  const plan = PLANS.pro;
  const baseUrl = getAppBaseUrl();
  const accountEmail = params.accountEmail.trim().toLowerCase();
  const payerEmail = params.payerEmail.trim().toLowerCase();
  const externalReference = buildExternalReference('pro', accountEmail);

  const body = {
    reason: `SEO Jump — Plan ${plan.label}`,
    external_reference: externalReference,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: plan.priceArs,
      currency_id: 'ARS',
    },
    back_url: `${baseUrl}/pago/exito`,
    status: 'pending',
    notification_url: `${baseUrl}/api/mercadopago/webhook?source_news=webhooks`,
  };

  const result = await mpFetch<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (!result.ok || !result.data?.init_point || !result.data?.id) {
    console.error('[MP] createProSubscriptionCheckout:', result.error, result.data);
    if (result.status === 401) {
      return {
        error:
          'Mercado Pago rechazó la cuenta vendedora. Verificá MP_ACCESS_TOKEN en Vercel (token renovado de cobros@) y que billing.allow sea true en /users/me.',
      };
    }
    return {
      error:
        result.error ||
        'No se pudo crear la suscripción. Verificá MP_ACCESS_TOKEN en Vercel.',
    };
  }

  return {
    initPoint: result.data.init_point,
    preapprovalId: result.data.id,
  };
}

export async function getPreapproval(preapprovalId: string): Promise<MpPreapproval | null> {
  const result = await mpFetch<MpPreapproval>(`/preapproval/${preapprovalId}`);
  if (!result.ok || !result.data) return null;
  return result.data;
}

/** Valida firma x-signature de webhooks (HMAC SHA256). */
export function verifyMpWebhookSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (!secret) return true; // sin secret configurado: aceptar (configurar en producción)

  const { xSignature, xRequestId, dataId } = params;
  if (!xSignature || !xRequestId || !dataId) return false;

  let ts: string | null = null;
  let hash: string | null = null;
  for (const part of xSignature.split(',')) {
    const [key, value] = part.split('=').map((s) => s.trim());
    if (key === 'ts') ts = value;
    if (key === 'v1') hash = value;
  }
  if (!ts || !hash) return false;

  const normalizedId = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${normalizedId};request-id:${xRequestId};ts:${ts};`;

  const computed = crypto
    .createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  return computed === hash;
}

type MpSearchResult = {
  results?: MpPreapproval[];
};

/** Busca suscripción activa del usuario (backup si el webhook tarda). */
export async function syncProSubscriptionForEmail(
  email: string
): Promise<'activated' | 'pending' | 'none' | 'error'> {
  const normalizedEmail = email.trim().toLowerCase();
  const expectedRef = buildExternalReference('pro', normalizedEmail);

  // Buscar por external_reference (el pagador MP puede usar otro email).
  const q = encodeURIComponent(expectedRef);
  const result = await mpFetch<MpSearchResult>(
    `/preapproval/search?q=${q}&sort=date_created&criteria=desc`
  );

  const results = result.data?.results ?? [];
  const matches = results.filter(
    (sub) => sub.external_reference === expectedRef
  );

  if (!result.ok || matches.length === 0) return 'none';

  for (const sub of matches) {
    const parsed = parseExternalReference(sub.external_reference);
    if (!parsed || parsed.email !== normalizedEmail) continue;

    const status = (sub.status || '').toLowerCase();
    if (status === 'authorized' || status === 'active') {
      const expiresAt = subscriptionExpiresInDays(35);
      const ok = await updateSubscriptionPlan(parsed.email, parsed.plan, expiresAt);
      return ok ? 'activated' : 'error';
    }
    if (status === 'pending') return 'pending';
  }

  return 'none';
}

type MpUserMe = {
  email?: string;
  sell?: { allow?: boolean };
  status?: { billing?: { allow?: boolean; codes?: string[] } };
};

/** Diagnóstico de credenciales y habilitación de cuenta vendedora. */
export async function getMpAccountHealth(): Promise<{
  ok: boolean;
  credentials: boolean;
  canSell: boolean;
  canBill: boolean;
  billingCodes: string[];
  email?: string;
  webhookUrl: string;
  hints: string[];
  error?: string;
}> {
  const webhookUrl = `${getAppBaseUrl()}/api/mercadopago/webhook?source_news=webhooks`;
  const hints: string[] = [];

  if (!getMpAccessToken()) {
    return {
      ok: false,
      credentials: false,
      canSell: false,
      canBill: false,
      billingCodes: [],
      webhookUrl,
      hints: ['Configurá MP_ACCESS_TOKEN en Vercel (token renovado de producción).'],
      error: 'MP_ACCESS_TOKEN no configurado',
    };
  }

  const me = await mpFetch<MpUserMe>('/users/me');
  if (!me.ok || !me.data) {
    return {
      ok: false,
      credentials: true,
      canSell: false,
      canBill: false,
      billingCodes: [],
      webhookUrl,
      hints: ['Token inválido o revocado. Renovalo en Developers y actualizá Vercel.'],
      error: me.error || 'No se pudo consultar /users/me',
    };
  }

  const canSell = me.data.sell?.allow === true;
  const canBill = me.data.status?.billing?.allow === true;
  const billingCodes = me.data.status?.billing?.codes ?? [];

  if (!canBill) {
    hints.push(
      `billing.allow=false${billingCodes.length ? ` (${billingCodes.join(', ')})` : ''} — la cuenta no puede crear suscripciones hasta que MP habilite el cobro.`
    );
  }
  if (!process.env.MP_WEBHOOK_SECRET?.trim()) {
    hints.push('Opcional: configurá MP_WEBHOOK_SECRET para validar webhooks en producción.');
  }

  return {
    ok: canSell && canBill,
    credentials: true,
    canSell,
    canBill,
    billingCodes,
    email: me.data.email,
    webhookUrl,
    hints,
  };
}
