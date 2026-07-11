import * as Sentry from '@sentry/nextjs';

/** True si hay DSN configurado (Vercel / .env local). */
export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Envía un error a Sentry con contexto extra (acción, input, etc.).
 * Si no hay DSN, no hace nada — seguro para dev local sin configurar.
 */
export function captureAppError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  if (!isSentryEnabled()) return;

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), 'error');
    }
  });
}
