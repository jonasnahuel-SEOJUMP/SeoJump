/**
 * Límites por plan — fuente única de verdad para créditos IA y sitios.
 * Ver docs/plan-negocio-seojump.md
 */

export type PlanId = 'free' | 'pro' | 'agency';

export type PlanLimits = {
  id: PlanId;
  label: string;
  priceArs: number;
  priceUsd: number;
  priceUsdNote: string;
  aiPerDay: number;
  aiPerMonth: number;
  maxSites: number;
};

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: 'free',
    label: 'Gratis',
    priceArs: 0,
    priceUsd: 0,
    priceUsdNote: '',
    aiPerDay: 2,
    aiPerMonth: 20,
    maxSites: 1,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    priceArs: 39_000,
    priceUsd: 27,
    priceUsdNote: 'IVA incluido',
    aiPerDay: 12,
    aiPerMonth: 250,
    maxSites: 1,
  },
  agency: {
    id: 'agency',
    label: 'Agencia',
    priceArs: 150_000,
    priceUsd: 105,
    priceUsdNote: '~USD 105/mes',
    aiPerDay: 40,
    aiPerMonth: 800,
    maxSites: 8,
  },
};

export type AiFeature =
  | 'quick_wins'
  | 'aeo'
  | 'buscador_oro'
  | 'detective_enlaces'
  | 'title_suggestion'
  | 'competitor_spy'
  | 'human_score';

export const AI_FEATURE_LABELS: Record<AiFeature, string> = {
  quick_wins: 'Quick Wins',
  aeo: 'Oportunidades AEO',
  buscador_oro: 'Buscador de Oro',
  detective_enlaces: 'Detective de Enlaces',
  title_suggestion: 'Sugerencia de Título',
  competitor_spy: 'Espía de la Competencia',
  human_score: 'Human Score',
};

/** Máximo de competidores rastreables por plan (Espía de la Competencia). */
export const MAX_COMPETITORS_BY_PLAN: Record<PlanId, number> = {
  free: 1,
  pro: 3,
  agency: 8,
};

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLANS[plan] ?? PLANS.free;
}

export function formatArs(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
