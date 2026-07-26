import { isPublicUrlSafe } from './urlSafety.js';
import { decryptWpToken, normalizeSiteUrl } from './wpCrypto';

export type WpApplyField = 'title' | 'meta' | 'h1';

export function mapMissionTypeToWpField(missionType: string): WpApplyField | null {
  const t = (missionType || '').toUpperCase();
  if (t === 'H1') return 'title'; // en WP suele ser título SEO + título del post
  if (t === 'META') return 'meta';
  return null;
}

export type WpPingResult =
  | { ok: true; pluginVersion?: string; siteName?: string }
  | { ok: false; error: string; code?: string };

export type WpApplyResult =
  | { ok: true; postId: number; updated: string[] }
  | { ok: false; error: string; code?: string };

function restBase(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, '')}/wp-json/seojump/v1`;
}

async function wpFetch(
  siteUrl: string,
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; data: any }> {
  const safe = isPublicUrlSafe(siteUrl);
  if (safe.safe === false) {
    return { status: 0, data: { error: safe.reason } };
  }

  const url = `${restBase(safe.url.replace(/\/$/, ''))}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers as Record<string, string>),
      },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err: any) {
    return {
      status: 0,
      data: { error: err?.message || 'No se pudo contactar el sitio WordPress.' },
    };
  }
}

export async function pingWpSite(siteUrl: string, token: string): Promise<WpPingResult> {
  const { status, data } = await wpFetch(siteUrl, token, '/ping', { method: 'GET' });
  if (status === 401 || status === 403) {
    return { ok: false, error: 'Token inválido. Regenerá la conexión y pegalo de nuevo en el plugin.', code: 'UNAUTHORIZED' };
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
      error: data?.error || data?.message || `Tu WordPress respondió con error (${status || 'red'}).`,
      code: 'HTTP_ERROR',
    };
  }
  return {
    ok: true,
    pluginVersion: data?.version,
    siteName: data?.siteName,
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
    return { ok: false, error: 'No pudimos leer el token guardado. Regenerá la conexión.', code: 'DECRYPT' };
  }

  const pageSafe = isPublicUrlSafe(params.pageUrl);
  if (pageSafe.safe === false) {
    return { ok: false, error: pageSafe.reason, code: 'BAD_URL' };
  }

  const value = (params.value || '').trim();
  if (!value) {
    return { ok: false, error: 'Falta el texto a aplicar.', code: 'EMPTY' };
  }
  if (value.length > 500) {
    return { ok: false, error: 'El texto es demasiado largo (máx. 500 caracteres).', code: 'TOO_LONG' };
  }

  const origin = normalizeSiteUrl(params.siteUrl);
  if (!origin) {
    return { ok: false, error: 'URL del sitio inválida.', code: 'BAD_SITE' };
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
      error: data?.error || 'No encontramos esa página en tu WordPress. ¿La URL es la correcta?',
      code: 'NOT_FOUND',
    };
  }
  if (status < 200 || status >= 300 || !data?.ok) {
    return {
      ok: false,
      error: data?.error || data?.message || `No se pudo aplicar el cambio (${status || 'red'}).`,
      code: 'APPLY_FAILED',
    };
  }

  return {
    ok: true,
    postId: Number(data.postId) || 0,
    updated: Array.isArray(data.updated) ? data.updated : [],
  };
}
