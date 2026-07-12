import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/adminGuard';
import { captureAppError, getSentryDsn, isSentryEnabled } from '../../../lib/sentry';

export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * GET /api/debug-sentry — envía un error de prueba a Sentry (solo admin).
 * Usalo una vez después de configurar SENTRY_DSN en Vercel.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  const dsn = getSentryDsn();
  const hasSentryDsn = Boolean(String(process.env['SENTRY_DSN'] || '').trim());
  const hasPublicSentryDsn = Boolean(String(process.env['NEXT_PUBLIC_SENTRY_DSN'] || '').trim());
  // Typo común: DNS en vez de DSN
  const hasTypoDns = Boolean(String(process.env['SENTRY_DNS'] || '').trim());

  if (!isSentryEnabled()) {
    return NextResponse.json({
      ok: false,
      sentryConfigured: false,
      hasSentryDsn,
      hasPublicSentryDsn,
      hasTypoDns,
      vercelEnv: process.env['VERCEL_ENV'] || null,
      hint: hasTypoDns
        ? 'Encontramos SENTRY_DNS (mal escrito). Renombrá a SENTRY_DSN y redeployá.'
        : 'El servidor no ve el DSN. Confirmá que las variables están en el proyecto de seo-jump.ai, con valor pegado (no vacío), y redeployá Production.',
    });
  }

  const testError = new Error('SEO Jump — prueba de Sentry (podés ignorar este issue)');
  captureAppError(testError, {
    source: 'debug-sentry',
    triggeredBy: guard.email,
    intentional: true,
  });

  return NextResponse.json({
    ok: true,
    sentryConfigured: true,
    dsnLength: dsn.length,
    vercelEnv: process.env['VERCEL_ENV'] || null,
    message: 'Error de prueba enviado. En 1-2 minutos debería aparecer en sentry.io → Issues.',
    hint: 'Marcá el issue como resuelto o ignorado después de verificar.',
  });
}
