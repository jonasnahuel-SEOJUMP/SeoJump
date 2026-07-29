/**
 * Control de créditos IA en servidor (Supabase).
 * Solo importar desde Server Actions / Route Handlers.
 */

import { supabaseAdmin, type Profile } from './supabase';
import {
  getPlanLimits,
  type PlanId,
  type AiFeature,
  AI_FEATURE_LABELS,
} from './planLimits';

export type AiCreditsStatus = {
  plan: PlanId;
  planLabel: string;
  usedToday: number;
  limitDay: number;
  usedMonth: number;
  limitMonth: number;
  remainingToday: number;
  remainingMonth: number;
  isUnlimited: boolean;
};

export type AiCreditCheckResult =
  | { allowed: true; status: AiCreditsStatus; fromCache?: boolean }
  | {
      allowed: false;
      code: 'AI_CREDIT_DAILY' | 'AI_CREDIT_MONTHLY' | 'NOT_AUTHENTICATED';
      error: string;
      status: AiCreditsStatus;
    };

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Plan efectivo: si la suscripción venció, vuelve a free.
 */
export function resolveEffectivePlan(profile: Pick<Profile, 'subscription_status'> & {
  subscription_expires_at?: string | null;
}): PlanId {
  const raw = profile.subscription_status;
  if (raw !== 'pro' && raw !== 'agency') return 'free';

  const expires = profile.subscription_expires_at;
  if (expires && new Date(expires).getTime() < Date.now()) {
    return 'free';
  }

  return raw;
}

async function getProfileByEmail(email: string): Promise<(Profile & { subscription_expires_at?: string | null }) | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, business_name, website_url, subscription_status, subscription_expires_at, created_at, updated_at')
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    console.warn('[aiCredits] getProfileByEmail:', error.message);
    return null;
  }

  return data as (Profile & { subscription_expires_at?: string | null }) | null;
}

async function getDailyCount(email: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { data } = await supabaseAdmin
    .from('ai_usage_daily')
    .select('count')
    .eq('email', normalizeEmail(email))
    .eq('usage_date', todayUtc())
    .maybeSingle();
  return data?.count ?? 0;
}

async function getMonthlyCount(email: string): Promise<number> {
  if (!supabaseAdmin) return 0;
  const { data } = await supabaseAdmin
    .from('ai_usage_monthly')
    .select('count')
    .eq('email', normalizeEmail(email))
    .eq('year_month', currentYearMonth())
    .maybeSingle();
  return data?.count ?? 0;
}

type ConsumeRpcResult = {
  allowed: boolean;
  code?: 'AI_CREDIT_DAILY' | 'AI_CREDIT_MONTHLY' | 'NOT_AUTHENTICATED';
  usedToday: number;
  usedMonth: number;
};

/**
 * Consume 1 crédito de forma atómica en Postgres (advisory lock + FOR UPDATE).
 * Evita races read-modify-write entre instancias serverless.
 */
async function consumeUsageAtomic(
  email: string,
  limitDay: number,
  limitMonth: number
): Promise<ConsumeRpcResult | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin.rpc('consume_ai_credit', {
    p_email: normalizeEmail(email),
    p_limit_day: limitDay,
    p_limit_month: limitMonth,
  });

  if (error) {
    console.error('[aiCredits] consume_ai_credit RPC:', error.message);
    return null;
  }

  const row = (typeof data === 'string' ? JSON.parse(data) : data) as ConsumeRpcResult | null;
  if (!row || typeof row.allowed !== 'boolean') return null;
  return {
    allowed: row.allowed,
    code: row.code,
    usedToday: Number(row.usedToday) || 0,
    usedMonth: Number(row.usedMonth) || 0,
  };
}

function buildStatus(
  plan: PlanId,
  usedToday: number,
  usedMonth: number,
  isUnlimited: boolean
): AiCreditsStatus {
  const limits = getPlanLimits(plan);
  const limitDay = isUnlimited ? 9999 : limits.aiPerDay;
  const limitMonth = isUnlimited ? 99999 : limits.aiPerMonth;

  return {
    plan,
    planLabel: limits.label,
    usedToday,
    limitDay,
    usedMonth,
    limitMonth,
    remainingToday: Math.max(0, limitDay - usedToday),
    remainingMonth: Math.max(0, limitMonth - usedMonth),
    isUnlimited,
  };
}

function limitErrorMessage(code: 'AI_CREDIT_DAILY' | 'AI_CREDIT_MONTHLY', status: AiCreditsStatus): string {
  if (code === 'AI_CREDIT_MONTHLY') {
    return `Llegaste al límite mensual de consultas IA (${status.limitMonth}). Se renueva el día 1 del próximo mes.`;
  }

  if (status.plan === 'free') {
    return `Usaste tus ${status.limitDay} consultas IA gratis de hoy. Volvé mañana o pasate a PRO.`;
  }
  if (status.plan === 'pro') {
    return `Llegaste al límite de hoy (${status.limitDay} consultas IA). Mañana se renuevan.`;
  }
  return `Tu agencia usó las ${status.limitDay} consultas IA de hoy. Mañana se renuevan o contactanos para ampliar el plan.`;
}

/**
 * Estado actual de créditos (sin consumir).
 */
export async function getAiCreditsStatus(
  email: string,
  options?: { isAdmin?: boolean }
): Promise<AiCreditsStatus> {
  const isAdmin = options?.isAdmin ?? false;
  if (isAdmin) {
    return buildStatus('agency', 0, 0, true);
  }

  const profile = await getProfileByEmail(email);
  const plan = profile ? resolveEffectivePlan(profile) : 'free';

  if (!supabaseAdmin) {
    return buildStatus(plan, 0, 0, false);
  }

  const [usedToday, usedMonth] = await Promise.all([
    getDailyCount(email),
    getMonthlyCount(email),
  ]);

  return buildStatus(plan, usedToday, usedMonth, false);
}

/**
 * Plan + créditos en una sola lectura (para paywall, perfil y UI).
 */
export async function getUserPlanSnapshot(
  email: string,
  options?: { isAdmin?: boolean }
): Promise<import('./subscription').UserPlanSnapshot> {
  const isAdmin = options?.isAdmin ?? false;
  const credits = await getAiCreditsStatus(email, { isAdmin });
  const profile = await getProfileByEmail(email);

  const hasPremiumAccess =
    isAdmin || credits.isUnlimited || credits.plan === 'pro' || credits.plan === 'agency';

  return {
    plan: credits.plan,
    planLabel: credits.planLabel,
    hasPremiumAccess,
    isAdmin,
    subscriptionExpiresAt: profile?.subscription_expires_at ?? null,
    credits,
  };
}

/**
 * Verifica cupo y consume 1 consulta IA si está permitido.
 */
export async function checkAndConsumeAiCredit(
  email: string,
  feature: AiFeature,
  options?: { isAdmin?: boolean; skipConsume?: boolean }
): Promise<AiCreditCheckResult> {
  const norm = normalizeEmail(email);
  if (!norm) {
    return {
      allowed: false,
      code: 'NOT_AUTHENTICATED',
      error: 'Tenés que iniciar sesión para usar la IA.',
      status: buildStatus('free', 0, 0, false),
    };
  }

  const isAdmin = options?.isAdmin ?? false;
  if (isAdmin) {
    const status = buildStatus('agency', 0, 0, true);
    return { allowed: true, status };
  }

  const profile = await getProfileByEmail(norm);
  const plan = profile ? resolveEffectivePlan(profile) : 'free';
  const limits = getPlanLimits(plan);

  if (!supabaseAdmin) {
    // Fail-closed: sin DB persistente el conteo gratis/PRO no es confiable.
    console.error('[aiCredits] Supabase no configurado — bloqueando consulta IA (fail-closed).');
    const status = buildStatus(plan, 0, 0, false);
    return {
      allowed: false,
      code: 'AI_CREDIT_DAILY',
      error: 'No pudimos verificar tu cupo de consultas IA. Intentá de nuevo en unos segundos.',
      status,
    };
  }

  // Solo lectura (UI / preflight): no incrementa.
  if (options?.skipConsume) {
    const [usedToday, usedMonth] = await Promise.all([
      getDailyCount(norm),
      getMonthlyCount(norm),
    ]);
    const status = buildStatus(plan, usedToday, usedMonth, false);

    if (usedMonth >= limits.aiPerMonth) {
      return {
        allowed: false,
        code: 'AI_CREDIT_MONTHLY',
        error: limitErrorMessage('AI_CREDIT_MONTHLY', status),
        status,
      };
    }
    if (usedToday >= limits.aiPerDay) {
      return {
        allowed: false,
        code: 'AI_CREDIT_DAILY',
        error: limitErrorMessage('AI_CREDIT_DAILY', status),
        status,
      };
    }
    return { allowed: true, status };
  }

  const consumed = await consumeUsageAtomic(norm, limits.aiPerDay, limits.aiPerMonth);
  if (!consumed) {
    const status = buildStatus(plan, 0, 0, false);
    return {
      allowed: false,
      code: 'AI_CREDIT_DAILY',
      error: 'No pudimos verificar tu cupo de consultas IA. Intentá de nuevo en unos segundos.',
      status,
    };
  }

  const status = buildStatus(plan, consumed.usedToday, consumed.usedMonth, false);

  if (consumed.allowed === false) {
    const code =
      consumed.code === 'AI_CREDIT_MONTHLY' ? 'AI_CREDIT_MONTHLY' : 'AI_CREDIT_DAILY';
    return {
      allowed: false,
      code,
      error: limitErrorMessage(code, status),
      status,
    };
  }

  console.log(
    `[aiCredits] ${norm} consumió 1 IA (${AI_FEATURE_LABELS[feature]}) — ${status.usedToday}/${status.limitDay} hoy`
  );
  return { allowed: true, status };
}

// ─── Caché Gemini (24h en Supabase) ────────────────────────────────────────

export function buildGeminiCacheKey(parts: string[]): string {
  return parts.map((p) => p.trim().toLowerCase()).filter(Boolean).join('::');
}

export async function getCachedGeminiResponse(cacheKey: string): Promise<string | null> {
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('ai_response_cache')
    .select('response_text, created_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error || !data) return null;

  const age = Date.now() - new Date(data.created_at).getTime();
  if (age > CACHE_TTL_MS) {
    await supabaseAdmin.from('ai_response_cache').delete().eq('cache_key', cacheKey);
    return null;
  }

  console.log(`[aiCredits] Cache HIT: ${cacheKey.slice(0, 60)}...`);
  return data.response_text;
}

export async function setCachedGeminiResponse(cacheKey: string, responseText: string): Promise<void> {
  if (!supabaseAdmin || !responseText) return;

  await supabaseAdmin.from('ai_response_cache').upsert(
    {
      cache_key: cacheKey,
      response_text: responseText,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' }
  );
}
