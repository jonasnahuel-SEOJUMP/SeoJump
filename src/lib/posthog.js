'use client';

import posthog from 'posthog-js';

/** Eventos estables de producto (no cambiar nombres a la ligera). */
export const PH_EVENTS = {
  CHECKOUT_STARTED: 'checkout_started',
  PAYMENT_SUCCESS: 'payment_success',
  QUICK_WIN_COMPLETED: 'quick_win_completed',
  AEO_COMPLETED: 'aeo_completed',
  AEO_ANALYZED: 'aeo_analyzed',
  COMPREHENSION_ANALYZED: 'comprehension_analyzed',
  COMPREHENSION_FAQ_APPLIED: 'comprehension_faq_applied',
};

export function getPostHogKey() {
  return String(process.env.NEXT_PUBLIC_POSTHOG_KEY || '').trim();
}

export function getPostHogHost() {
  return String(
    process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
  ).trim();
}

export function isPostHogEnabled() {
  return getPostHogKey().length > 0;
}

/**
 * Dispara un evento de producto. Seguro si PostHog no está configurado.
 * Solo corre en el navegador.
 */
export function trackEvent(eventName, properties = {}) {
  if (typeof window === 'undefined') return;
  if (!isPostHogEnabled()) return;
  try {
    if (!posthog.__loaded) return;
    posthog.capture(eventName, properties);
  } catch {
    /* nunca romper la UI por analytics */
  }
}
