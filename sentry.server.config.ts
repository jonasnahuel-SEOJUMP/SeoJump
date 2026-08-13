import * as Sentry from '@sentry/nextjs';

const raw = (process.env['SENTRY_DSN'] || process.env['NEXT_PUBLIC_SENTRY_DSN'] || '').trim();
const dsn = /^https?:\/\//i.test(raw) ? raw : '';

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  // Solo errores por ahora (sin métricas de performance = menos ruido y costo).
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
