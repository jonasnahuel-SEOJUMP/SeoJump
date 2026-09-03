/**
 * fetchPage.js — Descarga el HTML en vivo de una página pública, con timeout,
 * user-agent propio, sin caché y protección anti-SSRF (DNS + redirects).
 *
 * Camino rápido: fetch HTTP (safeHttp).
 * Respaldo: Chromium headless si el rápido falla o el HTML no es útil
 * (desafíos JS tipo Cloudflare, 403 soft, etc.).
 */

import { fetchHtmlSafe } from './safeHttp.js';

/**
 * Heurística: ¿el HTML parece una página real (no challenge / vacío)?
 * @param {string} html
 * @returns {boolean}
 */
export function htmlLooksUseful(html) {
  if (!html || typeof html !== 'string') return false;
  const trimmed = html.trim();
  if (trimmed.length < 80) return false;

  const titleMatch = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase()
    : '';
  const hasH1 = /<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(trimmed);

  // Desafíos Cloudflare / anti-bot típicos (tienen <title> pero no contenido útil).
  if (
    /just a moment|attention required|verificando tu navegador|checking your browser|enable javascript and cookies|cf-browser-verification|challenge-platform|_cf_chl/i.test(
      `${title} ${trimmed.slice(0, 4000)}`
    )
  ) {
    return false;
  }

  if (title || hasH1) return true;

  // Sin title ni H1: solo aceptar si hay bastante texto visible.
  const text = trimmed
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length >= 200;
}

/**
 * @param {string} pageUrl
 * @param {{
 *   timeoutMs?: number,
 *   headers?: Record<string, string>,
 *   dnsApi?: import('node:dns/promises'),
 *   browserFallback?: boolean,
 *   browserFetch?: (url: string, opts?: object) => Promise<{ ok: true, html: string, finalUrl?: string } | { ok: false, message: string }>,
 * }} [opts]
 * @returns {Promise<{ ok: true, html: string, finalUrl?: string } | { ok: false, message: string }>}
 */
export async function fetchPageHtml(pageUrl, opts = {}) {
  const { browserFallback = true, browserFetch, ...fastOpts } = opts;

  const fast = await fetchHtmlSafe(pageUrl, fastOpts);
  if (fast.ok && htmlLooksUseful(fast.html)) {
    return fast;
  }

  if (!browserFallback) {
    return fast.ok
      ? { ok: false, message: 'La página no devolvió contenido legible.' }
      : fast;
  }

  try {
    const runBrowser =
      browserFetch ||
      (await import('./fetchPageBrowser')).fetchPageHtmlWithBrowser;
    const slow = await runBrowser(pageUrl, {
      timeoutMs: Math.max(fastOpts.timeoutMs ?? 9000, 12000),
      dnsApi: fastOpts.dnsApi,
    });
    if (slow.ok && htmlLooksUseful(slow.html)) {
      return slow;
    }
    if (slow.ok) {
      return {
        ok: false,
        message:
          'La página no devolvió contenido legible (posible bloqueo anti-bot).',
      };
    }
    // Si el headless también falló, preferí el error del camino rápido si existía.
    return fast.ok === false ? fast : slow;
  } catch (err) {
    if (fast.ok === false) return fast;
    return {
      ok: false,
      message: `Error al acceder a la página: ${err?.message || err}`,
    };
  }
}
