import * as Sentry from '@sentry/nextjs';

/**
 * Lee el DSN en runtime (notación con corchetes para que Next/Turbopack
 * no lo reemplace por `undefined` en el build si faltaba la var en ese momento).
 */
export function getSentryDsn(): string {
  const raw =
    process.env['SENTRY_DSN'] ||
    process.env['NEXT_PUBLIC_SENTRY_DSN'] ||
    '';
  const dsn = String(raw).trim();
  if (!/^https?:\/\//i.test(dsn)) return '';
  return dsn;
}

/** True si hay DSN configurado (Vercel / .env local). */
export function isSentryEnabled(): boolean {
  return getSentryDsn().length > 0;
}

function ensureSentryClient(dsn: string): void {
  const client = Sentry.getClient();
  if (client?.getOptions()?.dsn) return;

  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env['VERCEL_ENV'] || process.env['NODE_ENV'] || 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/**
 * Envía un error a Sentry con contexto extra (acción, input, etc.).
 * Si no hay DSN, no hace nada — seguro para dev local sin configurar.
 */
export function captureAppError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const dsn = getSentryDsn();
  if (!dsn) return;

  ensureSentryClient(dsn);

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
