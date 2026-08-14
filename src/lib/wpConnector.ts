import { assertSafePublicUrl } from './urlSafety.js';
import { fetchWithSsrfGuard } from './safeHttp.js';
import { decryptWpToken, normalizeSiteUrl } from './wpCrypto';

/** Campos que entiende el plugin WordPress.
 * Solo título SEO y meta descripción.
 * FAQ visible / Schema JSON-LD NO se aplican por el conector: van por pegado
 * manual + verificación en vivo (política AEO / Wordfence en categorías).
 */
export type WpApplyField = 'seo_title' | 'meta';

export function mapMissionTypeToWpField(missionType: string): WpApplyField | null {
  const t = (missionType || '').toUpperCase();
  // En SEO Jump el tipo H1 cubre la misión de título SEO de la página.
  if (t === 'H1') return 'seo_title';
  if (t === 'META') return 'meta';
  return null;
}

export type WpPingResult =
  | { ok: true; pluginVersion?: string; siteName?: string; seoPlugin?: string }
  | { ok: false; error: string; code?: string };

export type WpApplyResult =
  | { ok: true; postId: number; termId?: number; updated: string[]; seoPlugin?: string }
  | { ok: false; error: string; code?: string };

function restBase(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, '')}/wp-json/seojump/v1`;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

/** True si pageUrl pertenece al mismo host que siteUrl. */
export function pageBelongsToSite(pageUrl: string, siteUrl: string): boolean {
  const pageHost = hostOf(pageUrl);
  const siteHost = hostOf(siteUrl);
  return Boolean(pageHost && siteHost && pageHost === siteHost);
}

function wpErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const d = data as { message?: string; error?: string; code?: string };
  return d.message || d.error || fallback;
}

async function wpFetch(
  siteUrl: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const originNorm = normalizeSiteUrl(siteUrl);
  if (!originNorm) {
    return { status: 0, data: { error: 'URL del sitio inválida.' } };
  }

  // DNS + sintaxis antes de armar el endpoint REST
  const safeOrigin = await assertSafePublicUrl(originNorm);
  if (safeOrigin.safe === false) {
    return { status: 0, data: { error: safeOrigin.reason } };
  }

  const url = `${restBase(normalizeSiteUrl(safeOrigin.url) || originNorm)}${path}`;
  const result = await fetchWithSsrfGuard(url, {
    method: (init.method as string) || 'GET',
    body: typeof init.body === 'string' ? init.body : undefined,
    timeoutMs: 12000,
    cacheBuster: false,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (result.ok === false) {
    return { status: 0, data: { error: result.message } };
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await result.response.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }
  return { status: result.response.status, data };
}

export async function pingWpSite(siteUrl: string, token: string): Promise<WpPingResult> {
  const { status, data } = await wpFetch(siteUrl, token, '/ping', { method: 'GET' });
  if (status === 401 || status === 403) {
    return {
      ok: false,
      error: 'Token inválido. Regenerá la conexión y pegalo de nuevo en el plugin.',
      code: 'UNAUTHORIZED',
    };
  }
  if (status === 404) {
    return {
      ok: false,
      error: 'No encontramos el plugin SEO Jump en tu WordPress. ¿Lo instalaste y activaste?',
      code: 'PLUGIN_MISSING',
    };
  }
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      error: wpErrorMessage(data, `Tu WordPress respondió con error (${status || 'red'}).`),
      code: 'HTTP_ERROR',
    };
  }
  return {
    ok: true,
    pluginVersion: typeof data?.version === 'string' ? data.version : undefined,
    siteName: typeof data?.siteName === 'string' ? data.siteName : undefined,
    seoPlugin: typeof data?.seoPlugin === 'string' ? data.seoPlugin : undefined,
  };
}

export async function applyWpChange(params: {
  siteUrl: string;
  tokenEncrypted: string;
  pageUrl: string;
  field: WpApplyField;
  value: string;
}): Promise<WpApplyResult> {
  let token: string;
  try {
    token = decryptWpToken(params.tokenEncrypted);
  } catch {
    return {
      ok: false,
      error: 'No pudimos leer el token guardado. Regenerá la conexión.',
      code: 'DECRYPT',
    };
  }

  const pageSafe = await assertSafePublicUrl(params.pageUrl);
  if (pageSafe.safe === false) {
    return { ok: false, error: pageSafe.reason, code: 'BAD_URL' };
  }

  const origin = normalizeSiteUrl(params.siteUrl);
  if (!origin) {
    return { ok: false, error: 'URL del sitio inválida.', code: 'BAD_SITE' };
  }

  if (!pageBelongsToSite(pageSafe.url, origin)) {
    return {
      ok: false,
      error: 'Esa página no pertenece al WordPress que conectaste.',
      code: 'WRONG_SITE',
    };
  }

  const value = (params.value || '').trim();
  if (!value) {
    return { ok: false, error: 'Falta el texto a aplicar.', code: 'EMPTY' };
  }
  if (value.length > 500) {
    return { ok: false, error: 'El texto es demasiado largo (máx. 500 caracteres).', code: 'TOO_LONG' };
  }

  const { status, data } = await wpFetch(origin, token, '/apply', {
    method: 'POST',
    body: JSON.stringify({
      pageUrl: pageSafe.url,
      field: params.field,
      value,
    }),
  });

  if (status === 401 || status === 403) {
    return { ok: false, error: 'Token inválido o revocado en WordPress.', code: 'UNAUTHORIZED' };
  }
  if (status === 404) {
    return {
      ok: false,
      error: wpErrorMessage(data, 'No encontramos esa página en tu WordPress.'),
      code: 'NOT_FOUND',
    };
  }
  if (status === 422) {
    return {
      ok: false,
      error: wpErrorMessage(
        data,
        'Tu WordPress necesita Yoast SEO o Rank Math para aplicar título/meta automático.'
      ),
      code: 'NO_SEO_PLUGIN',
    };
  }
  if (status < 200 || status >= 300 || !data?.ok) {
    return {
      ok: false,
      error: wpErrorMessage(data, `No se pudo aplicar el cambio (${status || 'red'}).`),
      code: 'APPLY_FAILED',
    };
  }

  return {
    ok: true,
    postId: Number(data.postId) || 0,
    termId: Number(data.termId) || 0,
    updated: Array.isArray(data.updated) ? (data.updated as string[]) : [],
    seoPlugin: typeof data.seoPlugin === 'string' ? data.seoPlugin : undefined,
  };
}
