/**
 * Modo prueba de pagos (local / sin credenciales Mobbex).
 * Activa PRO en Supabase sin llamar a la API de Mobbex.
 *
 * Activación:
 *   - PAYMENTS_STUB=true  → fuerza stub (solo usar en dev)
 *   - PAYMENTS_STUB=false → desactiva stub aunque falten credenciales
 *   - Por defecto: stub si estás en localhost Y no hay MOBBEX_API_KEY/TOKEN
 *
 * En producción (Vercel) sin PAYMENTS_STUB=true nunca simula pagos.
 */

import { updateSubscriptionPlan } from './supabase';

function expiresInDays(days = 35): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function appBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function isLocalDevHost(): boolean {
  return /localhost|127\.0\.0\.1/i.test(appBaseUrl());
}

export function hasMobbexCredentials(): boolean {
  return !!(
    process.env.MOBBEX_API_KEY?.trim() &&
    process.env.MOBBEX_ACCESS_TOKEN?.trim()
  );
}

/** True → usar stub en lugar de la API de Mobbex. */
export function isPaymentsStubMode(): boolean {
  const flag = process.env.PAYMENTS_STUB?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;

  // Producción remota: nunca stub salvo PAYMENTS_STUB=true explícito
  if (process.env.VERCEL_ENV === 'production' && !isLocalDevHost()) {
    return false;
  }

  if (hasMobbexCredentials()) return false;

  return isLocalDevHost() || process.env.NODE_ENV === 'development';
}

/** Activa plan PRO en Supabase (modo prueba). */
export async function stubActivateProPlan(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return (await updateSubscriptionPlan(normalized, 'pro', expiresInDays(35))).ok;
}

export function stubCheckoutUrl(): string {
  return `${appBaseUrl()}/pago/exito?stub=1`;
}
