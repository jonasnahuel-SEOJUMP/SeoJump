/**
 * urlSafety.js — Protección anti-SSRF para endpoints públicos que traen URLs
 * del lado del servidor. Bloquea localhost, IPs privadas/reservadas y esquemas
 * que no sean http/https.
 *
 * Nota: la validación es por host/IP-literal. No resuelve DNS, así que un
 * hostname que apunte a una IP privada no se detecta acá; para el caso de uso
 * (analizar webs públicas de clientes) esta capa cubre los vectores comunes.
 */

function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if ([a, parseInt(m[3], 10), parseInt(m[4], 10)].some((n) => n > 255)) return true; // inválida → bloquear
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // link-local / metadata cloud
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}

function isPrivateIpv6(host) {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::1' || h === '::') return true; // loopback / unspecified
  if (h.startsWith('fe80')) return true; // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local fc00::/7
  return false;
}

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
]);

/**
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
  if (!host.includes('.')) {
    return { safe: false, reason: 'Ingresá un dominio completo. Ej: tusitio.com' };
  }

  return { safe: true, url: url.toString() };
}
