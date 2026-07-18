/**
 * fetchPage.js — Descarga el HTML en vivo de una página pública, con timeout,
 * user-agent propio y sin caché. Reutilizable desde rutas API (no es 'use server').
 */

/**
 * @param {string} pageUrl
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<{ ok: true, html: string } | { ok: false, message: string }>}
 */
export async function fetchPageHtml(pageUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 9000;
  try {
    const finalUrl = pageUrl.includes('?')
      ? `${pageUrl}&nocache=${Date.now()}`
      : `${pageUrl}?nocache=${Date.now()}`;

    const response = await fetch(finalUrl, {
      cache: 'no-store',
      redirect: 'follow',
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

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

    return { ok: true, html: await response.text() };
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      return { ok: false, message: 'La página tardó demasiado en responder (>9s). Intentá de nuevo.' };
    }
    return { ok: false, message: `Error al acceder a la página: ${err?.message || err}` };
  }
}
