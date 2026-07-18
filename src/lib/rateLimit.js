/**
 * rateLimit.js — Rate limiter simple en memoria (por instancia).
 *
 * Suficiente como primera barrera para endpoints públicos. En un entorno
 * serverless multi-instancia el límite es best-effort por instancia; si se
 * necesita algo estricto y global, migrar a Redis/Upstash.
 */

const buckets = new Map();

/**
 * @param {string} key   Identificador (ej. `pubcomp:<ip>`).
 * @param {number} max   Máximo de solicitudes por ventana.
 * @param {number} windowMs  Duración de la ventana en ms.
 * @returns {{ allowed: true, remaining: number } | { allowed: false, retryAfterSec: number }}
 */
export function checkRateLimit(key, max = 8, windowMs = 60 * 60 * 1000) {
  const now = Date.now();

  // Limpieza oportunista para que el Map no crezca indefinidamente.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now > v.reset) buckets.delete(k);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count };
}

/** Solo para tests: limpia el estado. */
export function __resetRateLimit() {
  buckets.clear();
}
