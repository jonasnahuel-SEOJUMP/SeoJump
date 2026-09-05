/**
 * Reglas de prompt para proteger la identidad de marca en la HOME.
 * Aplica al H1 visible Y al <title>: en portada ambos suelen llevar el nombre
 * de la empresa; no tiene sentido reemplazarlos por keywords genéricas.
 */

export const HOME_BRAND_PROTECTION_MARKER =
  'PROTECCIÓN DE MARCA EN HOME (H1 y <title>)';

/**
 * Instrucción explícita para Gemini cuando pageType === 'home'.
 * Vacío en cualquier otro tipo (producto, categoría, post, etc.).
 */
export function homeBrandProtectionInstructions(
  pageType: string | null | undefined
): string {
  const t = String(pageType || '').toLowerCase().trim();
  if (t !== 'home') return '';

  return `
${HOME_BRAND_PROTECTION_MARKER} — OBLIGATORIA:
- En una HOME el H1 y el <title> suelen ser (o deben preservar) el NOMBRE DE LA MARCA/EMPRESA. PROHIBIDO reemplazar ese nombre por keywords genéricas del rubro (ej: "detailing store", "tienda de estética vehicular", "productos para autos") aunque el competidor las use.
- Podés sugerir: (a) un subtítulo/tagline SEO-friendly CERCA del H1 (sin reemplazar el H1 de marca), o (b) ajustar el <title> SOLO si el nombre de marca se mantiene (ej: "55 Detail Shop | Estética Vehicular en Carlos Paz" — la marca queda).
- Solo sugerí cambiar/reemplazar el H1 de home si está vacío, roto, duplicado o claramente no es el nombre del negocio.
- Esta regla aplica a AMBOS campos (H1 visible y <title>), no solo al H1.`.trim();
}

/**
 * Arma el bloque de contexto de tipo de página + protección de marca
 * para prompts de sugerencias de título/H1 (misiones, Quick Wins, Espía).
 * Testeable sin llamar a Gemini.
 */
export function buildTitleH1PromptPageRules(opts: {
  pageType?: string | null;
  isHubPage?: boolean;
}): string {
  const pageType = String(opts.pageType || (opts.isHubPage ? 'home' : '') || '')
    .toLowerCase()
    .trim();
  const effectiveType =
    opts.isHubPage && (!pageType || pageType === 'unknown') ? 'home' : pageType;
  const brandRule = homeBrandProtectionInstructions(
    effectiveType === 'home' || opts.isHubPage ? 'home' : effectiveType
  );
  if (!brandRule) return '';
  return brandRule;
}
