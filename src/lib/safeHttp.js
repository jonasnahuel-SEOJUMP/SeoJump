/**
 * safeHttp.js — Fetch HTTP con guarda anti-SSRF.
 *
 * - Resuelve DNS y bloquea IPs privadas/loopback/metadata antes de cada hop.
 * - Sigue redirects manualmente (redirect: 'manual') y revalida cada Location.
 */

import { assertSafePublicUrl } from './urlSafety.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
  Accept: 'text/html,application/xhtml+xml',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function addCacheBuster(url) {
  return url.includes('?') ? `${url}&nocache=${Date.now()}` : `${url}?nocache=${Date.now()}`;
}

/**
 * @typedef {{
 *   timeoutMs?: number,
 *   method?: string,
 *   headers?: Record<string, string>,
 *   body?: string,
 *   maxRedirects?: number,
 *   cacheBuster?: boolean,
 *   dnsApi?: import('node:dns/promises'),
 * }} SafeFetchOpts
 */

/**
 * Fetch con DNS + redirects seguros.
 * @param {string} pageUrl
 * @param {SafeFetchOpts} [opts]
 * @returns {Promise<
 *   | { ok: true, response: Response, finalUrl: string }
 *   | { ok: false, message: string }
 * >}
 */
export async function fetchWithSsrfGuard(pageUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 9000;
  const method = opts.method || 'GET';
  const maxRedirects = opts.maxRedirects ?? 5;
  const cacheBuster = opts.cacheBuster !== false && method === 'GET';
  const deadline = Date.now() + timeoutMs;

  let currentUrl = pageUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 50) {
      return { ok: false, message: 'La página tardó demasiado en responder. Intentá de nuevo.' };
    }

    const safe = await assertSafePublicUrl(currentUrl, opts.dnsApi);
    if (safe.safe === false) {
      return { ok: false, message: safe.reason };
    }

    const fetchUrl = hop === 0 && cacheBuster ? addCacheBuster(safe.url) : safe.url;

    let response;
    try {
      response = await fetch(fetchUrl, {
        method,
        body: opts.body,
        redirect: 'manual',
        cache: 'no-store',
        next: { revalidate: 0 },
        headers: {
          ...DEFAULT_HEADERS,
          ...(opts.headers || {}),
        },
        signal: AbortSignal.timeout(remaining),
      });
    } catch (err) {
      if (err?.name === 'TimeoutError') {
        return { ok: false, message: 'La página tardó demasiado en responder. Intentá de nuevo.' };
      }
      return { ok: false, message: `Error al acceder a la página: ${err?.message || err}` };
    }

    // Redirect hop — validar Location (URL + DNS) antes de seguir.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return { ok: false, message: 'La página devolvió un redirect sin destino.' };
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, safe.url).toString();
      } catch {
        return { ok: false, message: 'La página devolvió un redirect inválido.' };
      }
      // Consumir body del redirect para no dejar sockets colgados.
      try {
        await response.arrayBuffer();
      } catch {
        /* ignore */
      }
      currentUrl = nextUrl;
      continue;
    }

    return { ok: true, response, finalUrl: safe.url };
  }

  return { ok: false, message: 'Demasiados redirects. No se pueden analizar direcciones internas o privadas.' };
}

/**
 * Descarga HTML público con guarda SSRF (API compatible con fetchPageHtml).
 * @param {string} pageUrl
 * @param {{ timeoutMs?: number, headers?: Record<string, string>, dnsApi?: import('node:dns/promises'), cacheBuster?: boolean }} [opts]
 * @returns {Promise<{ ok: true, html: string, finalUrl?: string } | { ok: false, message: string }>}
 */
export async function fetchHtmlSafe(pageUrl, opts = {}) {
  const result = await fetchWithSsrfGuard(pageUrl, {
    timeoutMs: opts.timeoutMs ?? 9000,
    dnsApi: opts.dnsApi,
    headers: opts.headers,
    method: 'GET',
    cacheBuster: opts.cacheBuster !== false,
  });

  if (result.ok === false) return result;

  const { response, finalUrl } = result;

  if (!response.ok) {
    return {
      ok: false,
      message: `No pude acceder a la página (Error ${response.status}). Verificá que la URL sea pública.`,
    };
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    return { ok: false, message: 'Esa URL no devuelve una página web (HTML).' };
  }

  try {
    const html = await response.text();
    return { ok: true, html, finalUrl };
  } catch (err) {
    return { ok: false, message: `Error al leer la página: ${err?.message || err}` };
  }
}
