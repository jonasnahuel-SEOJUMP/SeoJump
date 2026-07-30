/**
 * fetchPage.js — Descarga el HTML en vivo de una página pública, con timeout,
 * user-agent propio, sin caché y protección anti-SSRF (DNS + redirects).
 */

import { fetchHtmlSafe } from './safeHttp.js';

/**
 * @param {string} pageUrl
 * @param {{ timeoutMs?: number, headers?: Record<string, string>, dnsApi?: import('node:dns/promises') }} [opts]
 * @returns {Promise<{ ok: true, html: string, finalUrl?: string } | { ok: false, message: string }>}
 */
export async function fetchPageHtml(pageUrl, opts = {}) {
  return fetchHtmlSafe(pageUrl, opts);
}
