/** Dominio público definitivo — único permitido en sitemap/robots para Search Console. */
export const CANONICAL_SITE_URL = "https://seo-jump.ai";

/**
 * Devuelve una URL http(s) absoluta o null si el valor no sirve para `new URL()`.
 */
function normalizeHttpUrl(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Base URL para sitemap.xml y robots.txt.
 * Siempre el dominio canónico; nunca *.vercel.app.
 */
export function getSitemapBaseUrl() {
  return CANONICAL_SITE_URL;
}

/** URL canónica del sitio (metadata, redirects, previews). */
export function getSiteUrl() {
  const fromEnv = normalizeHttpUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (fromEnv) return fromEnv;

  // Producción en Vercel: dominio custom, no el hostname interno del deploy.
  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_SITE_URL;
  }

  const vercelHost = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercelHost) {
    const fromVercel = normalizeHttpUrl(
      /^https?:\/\//i.test(vercelHost) ? vercelHost : `https://${vercelHost}`
    );
    if (fromVercel) return fromVercel;
  }

  return CANONICAL_SITE_URL;
}

/** Construye una URL absoluta bajo el dominio canónico (sitemap). */
export function toSitemapUrl(path = "/") {
  const base = getSitemapBaseUrl();
  if (!path || path === "/") return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
