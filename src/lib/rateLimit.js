/**
 * rateLimit.js — Rate limiter persistente (Supabase).
 *
 * En serverless el Map en memoria no es confiable (cold starts / multi-instancia).
 * El conteo vive en `rate_limit_buckets` vía RPC `check_rate_limit`.
 *
 * Para tests se puede inyectar `store` (Map en memoria) o `rpc` mock.
 */

import { supabaseAdmin } from './supabase';

/** @typedef {{ allowed: true, remaining: number } | { allowed: false, retryAfterSec: number }} RateLimitResult */

/**
 * Backend en memoria (solo tests / fallback controlado).
 * @param {Map<string, { count: number, reset: number }>} buckets
 * @param {string} key
 * @param {number} max
 * @param {number} windowMs
 * @returns {RateLimitResult}
 */
function checkRateLimitMemory(buckets, key, max, windowMs) {
  const now = Date.now();

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
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.reset - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: max - bucket.count };
}

const memoryFallback = new Map();

/**
 * @param {string} key
 * @param {number} [max]
 * @param {number} [windowMs]
 * @param {{
 *   rpc?: (name: string, args: object) => Promise<{ data: any, error: any }>,
 *   store?: Map<string, { count: number, reset: number }>,
 *   allowMemoryFallback?: boolean,
 * }} [opts]
 * @returns {Promise<RateLimitResult>}
 */
export async function checkRateLimit(key, max = 8, windowMs = 60 * 60 * 1000, opts = {}) {
  const safeKey = String(key || '').trim();
  if (!safeKey || max < 1) {
    return { allowed: false, retryAfterSec: 60 };
  }

  // Tests: store inyectado (memoria determinística).
  if (opts.store) {
    return checkRateLimitMemory(opts.store, safeKey, max, windowMs);
  }

  const hasCustomRpc = Object.prototype.hasOwnProperty.call(opts, 'rpc');
  const rpc = hasCustomRpc
    ? opts.rpc
    : supabaseAdmin
      ? (name, args) => supabaseAdmin.rpc(name, args)
      : null;

  if (!rpc) {
    // Sin DB: fail-closed en prod; en tests se usa `store`.
    if (opts.allowMemoryFallback === true) {
      return checkRateLimitMemory(memoryFallback, safeKey, max, windowMs);
    }
    console.warn('[rateLimit] Supabase no configurado — bloqueando (fail-closed).');
    return { allowed: false, retryAfterSec: 60 };
  }

  try {
    const { data, error } = await rpc('check_rate_limit', {
      p_key: safeKey,
      p_max: max,
      p_window_ms: windowMs,
    });

    if (error) {
      console.error('[rateLimit] RPC error:', error.message || error);
      return { allowed: false, retryAfterSec: 60 };
    }

    const row = typeof data === 'string' ? JSON.parse(data) : data;
    if (!row || row.allowed !== true) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Number(row?.retryAfterSec) || 60),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, Number(row.remaining) || 0),
    };
  } catch (err) {
    console.error('[rateLimit] unexpected:', err?.message || err);
    return { allowed: false, retryAfterSec: 60 };
  }
}

/** Solo para tests: limpia el fallback en memoria. */
export function __resetRateLimit() {
  memoryFallback.clear();
}
