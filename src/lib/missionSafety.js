/**
 * Guardrails de seguridad para misiones SEO.
 * Principio: nunca guiar a tocar slug / permalink / URL / Nombre (Woo),
 * porque rompe direcciones indexadas.
 */

/** Advertencia fija en pantallas de edición donde existe el campo Slug. */
export const SLUG_WARNING =
  '⚠️ No toques el campo Slug / Enlace permanente. Cambiarlo cambia la dirección de la página y se pierde el posicionamiento.';

/** Extra para categorías (pueden tener hijas). */
export const SLUG_WARNING_CATEGORY_CHILDREN =
  'Esta categoría tiene subcategorías: un cambio de slug cambiaría también sus direcciones.';

/**
 * Pantallas de WP/Woo donde el editor muestra Slug junto al Nombre/título.
 * home se edita como Página → también tiene slug.
 */
export function editScreenHasSlugField(pageTypeId) {
  return ['product', 'category', 'post', 'page', 'home'].includes(String(pageTypeId || ''));
}

/**
 * Advertencias de slug a mostrar en la UI / guía.
 * Para categorías siempre advertimos por subcategorías (no siempre sabemos si las hay).
 */
export function getSlugWarnings(pageTypeId) {
  if (!editScreenHasSlugField(pageTypeId)) return [];
  const warnings = [SLUG_WARNING];
  if (pageTypeId === 'category') {
    warnings.push(SLUG_WARNING_CATEGORY_CHILDREN);
  }
  return warnings;
}

/** Cláusulas que son advertencias (no acciones). */
const SAFE_NEGATION =
  /\bno\s+toques\b|\bno\s+cambies\b|\bno\s+modifiques\b|\bno\s+edites\b|\bnunca\s+toques\b|\bno\s+ajustes\b|\bsin\s+tocar\b|\bno\s+vayas\b/i;

/**
 * True si el texto instruye (como acción a realizar) modificar slug, URL,
 * permalink / enlace permanente, o el campo Nombre de producto/categoría.
 * Las advertencias del tipo «No toques el slug» NO cuentan como inseguras.
 *
 * Nota: no usamos \b después de letras con tilde (JS \w no incluye á/é/…).
 */
export function missionTextInstructsUnsafeUrlEdit(text) {
  const t = String(text || '').trim();
  if (!t) return false;

  const clauses = t
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    if (SAFE_NEGATION.test(clause)) continue;

    // Verbo + slug / permalink / enlace permanente / URL
    if (
      /(?:cambi[aá]|modific[aá]|edit[aá]|actualiz[aá]|ajust[aá]|reescrib\w*|pon[eé]|toc[aá])\w*.{0,48}(?:slug|permalink|enlace\s+permanente|\burl\b)/i.test(
        clause
      )
    ) {
      return true;
    }
    if (
      /(?:slug|permalink|enlace\s+permanente)\b.{0,48}(?:cambi|modific|edit|actualiz|ajust)/i.test(
        clause
      )
    ) {
      return true;
    }

    // Verbo + Nombre del producto / de la categoría
    if (
      /(?:ajust[aá]|cambi[aá]|modific[aá]|edit[aá]|borr[aá]|reescrib\w*|actualiz[aá]|peg[aá])\w*.{0,80}(?:nombre\s+del\s+producto|nombre\s+de\s+la\s+categor[ií]a)/i.test(
        clause
      )
    ) {
      return true;
    }

    // «ajustar el Nombre» / «cambiá el Nombre» (sin Título SEO en la misma cláusula)
    if (
      /(?:ajust[aá]|cambi[aá]|modific[aá]|edit[aá]|borr[aá])\w*\s+el\s+nombre\b/i.test(clause) &&
      !/t[ií]tulo\s+seo/i.test(clause)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Valida textos de guía / razón IA / pasos. Devuelve { ok, hits }.
 */
export function validateMissionTexts(texts) {
  const list = Array.isArray(texts) ? texts : [texts];
  const hits = [];
  for (const item of list) {
    const t = String(item || '');
    if (missionTextInstructsUnsafeUrlEdit(t)) hits.push(t);
  }
  return { ok: hits.length === 0, hits };
}

/**
 * Si la razón o el texto sugerido de la IA pide tocar slug/URL/Nombre,
 * se descarta (el caller debe usar plantilla segura).
 */
export function shouldDiscardAiMissionCopy({ suggestedTitle, reason } = {}) {
  return (
    missionTextInstructsUnsafeUrlEdit(reason) ||
    missionTextInstructsUnsafeUrlEdit(suggestedTitle)
  );
}
