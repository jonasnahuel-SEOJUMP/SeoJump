/**
 * Plan de suscripción — tipos y helpers compartidos (cliente + servidor).
 * Fuente de verdad en Supabase: profiles.subscription_status
 * (Mercado Pago actualizará ese campo cuando esté integrado).
 */

import type { PlanId } from './planLimits';
import type { AiCreditsStatus } from './aiCredits';

export type UserPlanSnapshot = {
  plan: PlanId;
  planLabel: string;
  /** PRO, Agencia o admin: desbloquea misiones ocultas y paywall */
  hasPremiumAccess: boolean;
  isAdmin: boolean;
  subscriptionExpiresAt: string | null;
  credits: AiCreditsStatus;
};

export function hasPremiumAccess(snapshot: UserPlanSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return snapshot.hasPremiumAccess;
}

export function formatPlanExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}
