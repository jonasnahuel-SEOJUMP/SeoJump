/** Dominio público definitivo — único permitido en sitemap/robots para Search Console. */
export const CANONICAL_SITE_URL = "https://seo-jump.ai";

/**
 * Base URL para sitemap.xml y robots.txt.
 * Siempre el dominio canónico; nunca *.vercel.app.
 */
export function getSitemapBaseUrl() {
  return CANONICAL_SITE_URL;
}

/** URL canónica del sitio (metadata, redirects, previews). */
export function getSiteUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  // Producción en Vercel: dominio custom, no el hostname interno del deploy.
  if (process.env.VERCEL_ENV === "production") {
    return CANONICAL_SITE_URL;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return CANONICAL_SITE_URL;
}

/** Construye una URL absoluta bajo el dominio canónico (sitemap). */
export function toSitemapUrl(path = "/") {
  const base = getSitemapBaseUrl();
  if (!path || path === "/") return base;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
