import { auth } from '../auth';
import { checkRateLimit } from './rateLimit';

export type ActionGuardFail = {
  ok: false;
  error: string;
  code: 'NOT_AUTHENTICATED' | 'RATE_LIMITED';
  retryAfterSec?: number;
};

export type ActionGuardOk = {
  ok: true;
  email: string;
};

/**
 * Exige sesión de Google y aplica rate-limit por usuario/feature.
 * Usar al inicio de server actions que scrapean o gastan recursos.
 */
export async function requireSignedIn(
  feature: string,
  maxPerHour = 120
): Promise<ActionGuardOk | ActionGuardFail> {
  const session = await auth();
  const email = (session?.user?.email || '').trim().toLowerCase();
  if (!email) {
    return {
      ok: false,
      error: 'Tenés que iniciar sesión para continuar.',
      code: 'NOT_AUTHENTICATED',
    };
  }

  const rl = checkRateLimit(`action:${feature}:${email}`, maxPerHour, 60 * 60 * 1000);
  if (rl.allowed === false) {
    return {
      ok: false,
      error: 'Demasiadas consultas seguidas. Esperá un momento e intentá de nuevo.',
      code: 'RATE_LIMITED',
      retryAfterSec: rl.retryAfterSec,
    };
  }

  return { ok: true, email };
}
