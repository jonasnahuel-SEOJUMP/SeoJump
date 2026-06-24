/**
 * Mobbex — suscripciones recurrentes (API /p/subscriptions).
 * Docs: https://mobbex.dev/suscripciones
 */

import type { PlanId } from './planLimits';
import { PLANS } from './planLimits';
import { updateSubscriptionPlan } from './supabase';
import {
  isPaymentsStubMode,
  stubActivateProPlan,
  stubCheckoutUrl,
} from './paymentsStub';

const MOBBEX_API = 'https://api.mobbex.com/p';
const PRODUCTION_BASE = 'https://seo-jump.ai';
const PRO_SUBSCRIPTION_NAME = 'SEO Jump — Plan PRO';

export type MobbexApiResponse<T = unknown> = {
  result?: boolean;
  data?: T;
  code?: string | number;
  error?: string;
  message?: string;
};

type MobbexSubscription = {
  uid?: string;
  id?: string;
  name?: string;
  status?: string;
};

type MobbexSubscriber = {
  uid?: string;
  id?: string;
  reference?: string;
  status?: string;
  url?: string;
  source?: { url?: string };
};

export function getAppBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    PRODUCTION_BASE;
  return raw.replace(/\/$/, '');
}

export function getMobbexCallbackBaseUrl(): string {
  const base = getAppBaseUrl();
  const isLocal = /localhost|127\.0\.0\.1/i.test(base) || /^http:\/\//i.test(base);
  if (isLocal) return PRODUCTION_BASE;
  return base;
}

export function getMobbexCredentials(): { apiKey: string; accessToken: string } | null {
  const apiKey = process.env.MOBBEX_API_KEY?.trim();
  const accessToken = process.env.MOBBEX_ACCESS_TOKEN?.trim();
  if (!apiKey || !accessToken) return null;
  return { apiKey, accessToken };
}

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

async function mobbexFetch<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: MobbexApiResponse<T> | null; error?: string }> {
  const creds = getMobbexCredentials();
  if (!creds) {
    return { ok: false, status: 500, data: null, error: 'MOBBEX_API_KEY / MOBBEX_ACCESS_TOKEN no configurados' };
  }

  const res = await fetch(`${MOBBEX_API}${path}`, {
    method,
    headers: {
      'x-api-key': creds.apiKey,
      'x-access-token': creds.accessToken,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data: MobbexApiResponse<T> | null = null;
  try {
    data = (await res.json()) as MobbexApiResponse<T>;
  } catch {
    data = null;
  }

  if (!res.ok || data?.result === false) {
    const msg =
      data?.error ||
      data?.message ||
      (typeof data?.code === 'string' ? data.code : undefined) ||
      `Mobbex HTTP ${res.status}`;
    return { ok: false, status: res.status, data, error: String(msg) };
  }

  return { ok: true, status: res.status, data };
}

function subscriptionId(sub: MobbexSubscription): string | null {
  return sub.uid || sub.id || null;
}

function subscriberId(sub: MobbexSubscriber): string | null {
  return sub.uid || sub.id || null;
}

function extractCheckoutUrl(payload: MobbexApiResponse<MobbexSubscriber> | null): string | null {
  const data = payload?.data as MobbexSubscriber | undefined;
  if (!data) return null;
  return data.url || data.source?.url || null;
}

async function getProSubscriptionId(callbackBase: string): Promise<string | { error: string }> {
  const fromEnv = process.env.MOBBEX_SUBSCRIPTION_ID?.trim();
  if (fromEnv) return fromEnv;

  const list = await mobbexFetch<MobbexSubscription[]>('/subscriptions', 'GET');
  if (list.ok && Array.isArray(list.data?.data)) {
    const existing = list.data!.data!.find(
      (s) => (s.name || '').toLowerCase() === PRO_SUBSCRIPTION_NAME.toLowerCase()
    );
    const id = existing ? subscriptionId(existing) : null;
    if (id) return id;
  }

  const plan = PLANS.pro;
  const created = await mobbexFetch<MobbexSubscription>('/subscriptions', 'POST', {
    total: plan.priceArs,
    currency: 'ARS',
    name: PRO_SUBSCRIPTION_NAME,
    description: `Suscripción mensual ${plan.label} — SEO Jump`,
    type: 'dynamic',
    interval: '1m',
    trial: 0,
    limit: 0,
    webhook: `${callbackBase}/api/mobbex/webhook`,
    return_url: `${callbackBase}/pago/exito`,
    test: process.env.MOBBEX_TEST === 'true',
  });

  if (!created.ok || !created.data?.data) {
    return { error: created.error || 'No se pudo crear el plan de suscripción en Mobbex' };
  }

  const id = subscriptionId(created.data.data as MobbexSubscription);
  if (!id) {
    return { error: 'Mobbex no devolvió ID de suscripción. Guardalo en MOBBEX_SUBSCRIPTION_ID.' };
  }

  console.info('[Mobbex] Plan PRO creado:', id, '→ podés fijarlo en MOBBEX_SUBSCRIPTION_ID');
  return id;
}

/** Verifica credenciales y plan PRO (útil al conectar la consola). */
export async function getMobbexAccountHealth(): Promise<{
  ok: boolean;
  credentials: boolean;
  subscriptionId?: string;
  webhookUrl: string;
  callbackBase: string;
  hints: string[];
  error?: string;
  stub?: boolean;
}> {
  const callbackBase = getMobbexCallbackBaseUrl();
  const webhookUrl = `${callbackBase}/api/mobbex/webhook`;
  const hints: string[] = [];

  if (isPaymentsStubMode()) {
    return {
      ok: true,
      credentials: false,
      stub: true,
      webhookUrl,
      callbackBase,
      hints: [
        'Modo prueba local: los pagos ARS simulan éxito y activan PRO en Supabase.',
        'Configurá MOBBEX_API_KEY y MOBBEX_ACCESS_TOKEN para usar Mobbex real.',
      ],
    };
  }

  const creds = getMobbexCredentials();

  if (!creds) {
    return {
      ok: false,
      credentials: false,
      webhookUrl,
      callbackBase,
      hints: ['Configurá MOBBEX_API_KEY y MOBBEX_ACCESS_TOKEN en .env.local o Vercel.'],
      error: 'Credenciales no configuradas',
    };
  }

  const list = await mobbexFetch<MobbexSubscription[]>('/subscriptions', 'GET');
  if (!list.ok) {
    return {
      ok: false,
      credentials: true,
      webhookUrl,
      callbackBase,
      hints: ['Token inválido o cuenta aún no habilitada por Mobbex.'],
      error: list.error,
    };
  }

  const fromEnv = process.env.MOBBEX_SUBSCRIPTION_ID?.trim();
  let proPlanId = fromEnv;
  if (!proPlanId && Array.isArray(list.data?.data)) {
    const existing = list.data!.data!.find(
      (s) => (s.name || '').toLowerCase() === PRO_SUBSCRIPTION_NAME.toLowerCase()
    );
    proPlanId = existing ? subscriptionId(existing) ?? undefined : undefined;
  }

  if (proPlanId) {
    hints.push(`Plan PRO encontrado: ${proPlanId}`);
  } else {
    hints.push('Sin plan PRO aún — se creará automáticamente en el primer checkout.');
  }

  hints.push(`Webhook: ${webhookUrl}`);
  hints.push(`Return URL: ${callbackBase}/pago/exito`);

  return { ok: true, credentials: true, subscriptionId: proPlanId, webhookUrl, callbackBase, hints };
}

export async function createProSubscriptionCheckout(params: {
  accountEmail: string;
  customerName?: string;
}): Promise<
  | { checkoutUrl: string; subscriptionId: string; subscriberId: string; stub?: boolean }
  | { error: string }
> {
  const accountEmail = params.accountEmail.trim().toLowerCase();

  if (isPaymentsStubMode()) {
    const ok = await stubActivateProPlan(accountEmail);
    if (!ok) {
      return {
        error:
          'Modo prueba: no se pudo activar PRO en Supabase. Revisá SUPABASE_SERVICE_ROLE_KEY en .env.local.',
      };
    }
    console.info('[Mobbex stub] PRO activado para', accountEmail);
    return {
      checkoutUrl: stubCheckoutUrl(),
      subscriptionId: 'stub',
      subscriberId: 'stub',
      stub: true,
    };
  }

  const callbackBase = getMobbexCallbackBaseUrl();
  const externalReference = buildExternalReference('pro', accountEmail);

  const subscriptionResult = await getProSubscriptionId(callbackBase);
  if (typeof subscriptionResult !== 'string') {
    return { error: subscriptionResult.error };
  }

  const now = new Date();
  const subscriberBody = {
    customer: {
      email: accountEmail,
      name: params.customerName?.trim() || accountEmail.split('@')[0] || 'Usuario SEO Jump',
      identification: '00000000',
    },
    reference: externalReference,
    startDate: {
      day: now.getDate(),
      month: now.getMonth() + 1,
    },
  };

  const created = await mobbexFetch<MobbexSubscriber>(
    `/subscriptions/${subscriptionResult}/subscriber`,
    'POST',
    subscriberBody
  );

  if (!created.ok || !created.data?.data) {
    console.error('[Mobbex] create subscriber:', created.error, created.data);
    return { error: created.error || 'No se pudo crear el suscriptor en Mobbex' };
  }

  const sub = created.data.data as MobbexSubscriber;
  const sid = subscriberId(sub);
  const checkoutUrl = extractCheckoutUrl(created.data);

  if (!sid || !checkoutUrl) {
    console.error('[Mobbex] missing url or subscriber id:', created.data);
    return {
      error:
        'Mobbex creó el suscriptor pero no devolvió URL de pago. Revisá la consola de Mobbex.',
    };
  }

  return {
    checkoutUrl,
    subscriptionId: subscriptionResult,
    subscriberId: sid,
  };
}

export async function getSubscriber(
  subscriptionId: string,
  subscriberId: string
): Promise<MobbexSubscriber | null> {
  const result = await mobbexFetch<MobbexSubscriber>(
    `/subscriptions/${subscriptionId}/subscriber/${subscriberId}`,
    'GET'
  );
  if (!result.ok || !result.data?.data) return null;
  return result.data.data as MobbexSubscriber;
}

function isSubscriberActive(status: string | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s === 'active' || s === 'authorized' || s === 'subscribed' || s === '1';
}

/** Backup post-pago: busca suscriptor por reference y activa PRO si está activo. */
export async function syncProSubscriptionForEmail(
  email: string
): Promise<'activated' | 'pending' | 'none' | 'error'> {
  const normalizedEmail = email.trim().toLowerCase();

  if (isPaymentsStubMode()) {
    const ok = await stubActivateProPlan(normalizedEmail);
    return ok ? 'activated' : 'error';
  }

  const expectedRef = buildExternalReference('pro', normalizedEmail);

  const subscriptionResult = await getProSubscriptionId(getMobbexCallbackBaseUrl());
  if (typeof subscriptionResult !== 'string') return 'error';

  let page = 1;
  for (let i = 0; i < 10; i++) {
    const list = await mobbexFetch<MobbexSubscriber[]>(
      `/subscriptions/${subscriptionResult}/subscriber?page=${page}`,
      'GET'
    );
    if (!list.ok) return 'error';

    const rows = list.data?.data;
    if (!Array.isArray(rows) || rows.length === 0) break;

    for (const row of rows) {
      if (row.reference !== expectedRef) continue;
      const sid = subscriberId(row);
      if (!sid) continue;

      const detail = await getSubscriber(subscriptionResult, sid);
      const status = detail?.status || row.status;

      if (isSubscriberActive(status)) {
        const expiresAt = subscriptionExpiresInDays(35);
        const ok = await updateSubscriptionPlan(normalizedEmail, 'pro', expiresAt);
        return ok ? 'activated' : 'error';
      }
      return 'pending';
    }

    if (rows.length < 20) break;
    page += 1;
  }

  return 'none';
}

/** Webhook Mobbex — activa o baja plan según estado del pago/ejecución. */
export async function handleMobbexWebhook(body: Record<string, unknown>): Promise<boolean> {
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const payment = (data.payment as Record<string, unknown> | undefined) ?? data;
  const status = (data.status as { code?: string | number; text?: string } | undefined) ??
    (payment.status as { code?: string | number; text?: string } | undefined);

  const code = String(status?.code ?? '');
  const ref =
    (payment.reference as string | undefined) ||
    (data.reference as string | undefined) ||
    (body.reference as string | undefined);

  const parsed = parseExternalReference(ref);
  if (!parsed) {
    console.warn('[Mobbex webhook] reference no reconocida:', ref);
    return true;
  }

  const successCodes = new Set(['200', '3', '100', 'approved', 'paid']);
  const isSuccess = successCodes.has(code) || code.toLowerCase() === 'approved';

  if (isSuccess) {
    const expiresAt = subscriptionExpiresInDays(35);
    const ok = await updateSubscriptionPlan(parsed.email, parsed.plan, expiresAt);
    console.log(`[Mobbex webhook] PRO activado ${parsed.email} → ${ok}`);
    return ok;
  }

  const failCodes = new Set(['401', '402', '403', '404', 'cancelled', 'canceled', 'suspended']);
  if (failCodes.has(code) || failCodes.has(code.toLowerCase())) {
    const ok = await updateSubscriptionPlan(parsed.email, 'free', null);
    console.log(`[Mobbex webhook] plan free ${parsed.email} (code=${code}) → ${ok}`);
    return ok;
  }

  console.log('[Mobbex webhook] evento sin acción, code=', code, 'ref=', ref);
  return true;
}
