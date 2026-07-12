import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../lib/adminGuard';
import { captureAppError, isSentryEnabled } from '../../../lib/sentry';

export const maxDuration = 15;

/**
 * GET /api/debug-sentry — envía un error de prueba a Sentry (solo admin).
 * Usalo una vez después de configurar SENTRY_DSN en Vercel.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  if (!isSentryEnabled()) {
    return NextResponse.json({
      ok: false,
      sentryConfigured: false,
      hint: 'Faltan SENTRY_DSN y/o NEXT_PUBLIC_SENTRY_DSN en Vercel. Redeploy después de agregarlas.',
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
    message: 'Error de prueba enviado. En 1-2 minutos debería aparecer en sentry.io → Issues.',
    hint: 'Marcá el issue como resuelto o ignorado después de verificar.',
  });
}
