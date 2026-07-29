/**
 * urlSafety.js — Protección anti-SSRF para fetches del servidor.
 *
 * Capas:
 * 1) Validación sintáctica (esquema, host bloqueado, IP literal privada).
 * 2) Resolución DNS: si el hostname resuelve a IP privada/loopback/metadata,
 *    se bloquea (cubre rebinding básico pre-fetch).
 *
 * Los redirects se validan hop-a-hop en safeHttp.js (redirect: 'manual').
 */

import dns from 'node:dns/promises';

function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[4], 10)];
  if (octets.some((n) => n > 255)) return true; // inválida → bloquear
  const [a, b] = octets;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18.0.0/15
  return false;
}

function isPrivateIpv6(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local fc00::/7
  // IPv4-mapped / IPv4-compatible
  const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIpv4Literal(host) {
  return IPV4_RE.test(host);
}

function isIpv6Literal(host) {
  const h = host.replace(/^\[|\]$/g, '');
  return h.includes(':');
}

/** True si la IP (v4/v6) es privada, loopback, link-local o metadata. */
export function isBlockedIp(address) {
  if (!address || typeof address !== 'string') return true;
  const host = address.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (isIpv4Literal(host)) return isPrivateIpv4(host);
  if (host.includes(':')) return isPrivateIpv6(host);
  return true; // no parece IP → no debería llegar acá
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
]);

/**
 * Validación sintáctica (sin DNS).
 * @param {string} rawUrl
 * @returns {{ safe: true, url: string } | { safe: false, reason: string }}
 */
export function isPublicUrlSafe(rawUrl) {
  const input = (rawUrl || '').trim();
  if (!input) return { safe: false, reason: 'Pegá la URL de tu página.' };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return { safe: false, reason: 'Esa URL no es válida. Ej: https://tusitio.com/pagina' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { safe: false, reason: 'Solo se permiten direcciones http o https.' };
  }

  const host = url.hostname.toLowerCase();

  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { safe: false, reason: 'No se pueden analizar direcciones internas.' };
  }

  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return { safe: false, reason: 'No se pueden analizar direcciones internas o privadas.' };
  }

  // Debe tener al menos un punto en el dominio (evita hosts sueltos tipo "router")
  // Las IPs literales públicas ya pasaron el check de arriba (ej. 8.8.8.8 tiene puntos).
  if (!host.includes('.') && !isIpv6Literal(host)) {
    return { safe: false, reason: 'Ingresá un dominio completo. Ej: tusitio.com' };
  }

  return { safe: true, url: url.toString() };
}

/**
 * Resuelve A/AAAA del hostname. Si alguna falla con ENODATA, sigue con la otra.
 * @param {string} hostname
 * @param {typeof dns} [dnsApi]
 * @returns {Promise<string[]>}
 */
export async function resolveHostAddresses(hostname, dnsApi = dns) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (isIpv4Literal(host) || isIpv6Literal(host)) {
    return [host];
  }

  const addresses = new Set();

  const settle = async (fn) => {
    try {
      const list = await fn();
      for (const a of list) addresses.add(a);
    } catch (err) {
      if (err && (err.code === 'ENODATA' || err.code === 'ENOTFOUND' || err.code === 'EREFUSED')) {
        return;
      }
      // Otros errores (timeout, etc.) se relegan al fallback lookup.
    }
  };

  await Promise.all([
    settle(() => dnsApi.resolve4(host)),
    settle(() => dnsApi.resolve6(host)),
  ]);

  if (addresses.size === 0) {
    try {
      const lookups = await dnsApi.lookup(host, { all: true, verbatim: true });
      for (const row of lookups) {
        if (row?.address) addresses.add(row.address);
      }
    } catch {
      /* vacío → caller bloquea */
    }
  }

  return Array.from(addresses);
}

/**
 * Validación completa pre-fetch: sintaxis + DNS → ninguna IP bloqueada.
 * @param {string} rawUrl
 * @param {typeof dns} [dnsApi]  Inyectable para tests.
 * @returns {Promise<{ safe: true, url: string, addresses: string[] } | { safe: false, reason: string }>}
 */
export async function assertSafePublicUrl(rawUrl, dnsApi = dns) {
  const sync = isPublicUrlSafe(rawUrl);
  if (sync.safe === false) return sync;

  let hostname;
  try {
    hostname = new URL(sync.url).hostname;
  } catch {
    return { safe: false, reason: 'Esa URL no es válida. Ej: https://tusitio.com/pagina' };
  }

  let addresses;
  try {
    addresses = await resolveHostAddresses(hostname, dnsApi);
  } catch {
    return { safe: false, reason: 'No pudimos resolver el dominio. Verificá la URL.' };
  }

  if (!addresses.length) {
    return { safe: false, reason: 'No pudimos resolver el dominio. Verificá la URL.' };
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      return {
        safe: false,
        reason: 'No se pueden analizar direcciones internas o privadas.',
      };
    }
  }

  return { safe: true, url: sync.url, addresses };
}
