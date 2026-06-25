/**
 * Decodifica entidades HTML comunes (WordPress / Yoast suelen usar &#8211;, etc.)
 */
export function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Normaliza texto de misión para comparar título/meta en vivo vs sugerencia. */
export function normalizeMissionText(t) {
  return decodeHtmlEntities(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¡!¿?:;"'|\[\]\u2013\u2014\u2026|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparación flexible (verificación en vivo, keyword gate, etc.) */
export function textsMatchLoosely(a, b) {
  const na = normalizeMissionText(a);
  const nb = normalizeMissionText(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * ¿El cambio sugerido ya está aplicado en la web?
 * Más estricto que textsMatchLoosely: si la sugerencia solo AGREGA texto
 * (ej. «| Comprá Online»), no cuenta como hecho.
 */
export function isMissionChangeFullyApplied(current, suggested) {
  const na = normalizeMissionText(current);
  const nb = normalizeMissionText(suggested);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // El usuario ya superó o igualó la sugerencia completa
  if (na.includes(nb)) return true;
  // La sugerencia extiende lo actual → todavía hay algo por aplicar
  if (nb.includes(na)) {
    const extra = nb.slice(na.length).trim();
    return extra.length === 0;
  }
  return false;
}

/**
 * Parte que la sugerencia agrega y el título actual no tiene (para mensaje parcial).
 * Devuelve null si no aplica.
 */
export function getMissionSuggestionAddon(current, suggested) {
  const na = normalizeMissionText(current);
  const nb = normalizeMissionText(suggested);
  if (!na || !nb || na === nb || na.includes(nb)) return null;
  if (!nb.includes(na)) return null;

  const extraNorm = nb.slice(na.length).trim();
  if (!extraNorm) return null;

  const extraWordCount = extraNorm.split(/\s+/).filter(Boolean).length;
  const origWords = decodeHtmlEntities(suggested).trim().split(/\s+/);
  const addon = origWords.slice(-extraWordCount).join(' ').trim();
  return addon || extraNorm;
}
