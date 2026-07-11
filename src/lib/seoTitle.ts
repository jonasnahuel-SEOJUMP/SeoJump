/** Límites de longitud para títulos SEO (Yoast / Rank Math — zona verde) */
export const MAX_SEO_TITLE_LENGTH = 60;
export const IDEAL_SEO_TITLE_MIN = 50;

function cleanTrailingSeparators(s: string): string {
  return s.replace(/[\s\-–—|.,]+$/, '').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isSeoTitleLengthOk(title: string, maxLen = MAX_SEO_TITLE_LENGTH): boolean {
  return !!(title && title.length <= maxLen);
}

/**
 * Ajusta un título sugerido al máximo permitido. Prioriza quitar el sufijo de
 * marca/tienda antes de truncar a mitad de frase.
 */
export function fitSeoTitle(
  title: string,
  options?: { maxLen?: number; brandHints?: string[] }
): string {
  const maxLen = options?.maxLen ?? MAX_SEO_TITLE_LENGTH;
  let t = (title || '').trim();
  if (!t || t.length <= maxLen) return t;

  const brandHints = (options?.brandHints || [])
    .map((b) => (b || '').trim())
    .filter(Boolean);

  for (const brand of brandHints) {
    for (const sep of ['|', '-', '–', '—']) {
      const re = new RegExp(`\\s*${escapeRegex(sep)}\\s*${escapeRegex(brand)}\\s*$`, 'i');
      const stripped = cleanTrailingSeparators(t.replace(re, ''));
      if (stripped.length <= maxLen && stripped.length >= 20) {
        t = stripped;
        if (t.length <= maxLen) return t;
      }
    }
  }

  const pipeParts = t.split(/\s*\|\s*/);
  if (pipeParts.length > 1) {
    const withoutLast = cleanTrailingSeparators(pipeParts.slice(0, -1).join(' | '));
    if (withoutLast.length <= maxLen && withoutLast.length >= 20) {
      return withoutLast;
    }
  }

  const cut = t.lastIndexOf(' ', maxLen - 1);
  return cleanTrailingSeparators(
    cut > maxLen * 0.5 ? t.slice(0, cut) : t.slice(0, maxLen)
  );
}

/** Extrae posibles nombres de marca/tienda desde un título o contexto de negocio */
export function extractBrandHints(...sources: Array<string | undefined | null>): string[] {
  const hints = new Set<string>();
  for (const src of sources) {
    const text = (src || '').trim();
    if (!text) continue;
    const parts = text.split(/\s*[|–—]\s*|\s+-\s+/);
    const last = (parts[parts.length - 1] || '').trim();
    if (last.length >= 3 && last.length <= 40) hints.add(last);
  }
  return [...hints];
}
