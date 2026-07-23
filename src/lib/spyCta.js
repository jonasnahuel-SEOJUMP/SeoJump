/** Ruta del Espía tras login / para usuarios ya autenticados. */
export const SPY_CALLBACK_PATH = "/detective-de-enlaces?view=spy";

/**
 * Href nativo al OAuth de Google con callback al Espía.
 * Sirve de fallback si el JS de la landing no hidrata (botón sin onClick).
 */
export function spyGoogleSignInHref(callbackPath = SPY_CALLBACK_PATH) {
  return `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackPath)}`;
}
