/**
 * Política AEO → Schema por tipo de URL.
 *
 * Principio de producto:
 * 1) SEO Jump ayuda a crear información útil y estructurada para humanos/IA.
 * 2) Después, cuando el tipo de página lo justifica, transforma eso en Schema técnico.
 *
 * Human Score / preguntas útiles van al centro. Schema no es el primer mensaje.
 */

import type { ComprehensionPageType } from './comprehension';

export type AeoPageType = ComprehensionPageType;

export const AEO_PAGE_TYPE_LABELS: Record<AeoPageType, string> = {
  product: 'producto',
  category: 'categoría',
  post: 'entrada / artículo',
  page: 'página',
  home: 'inicio (home)',
  unknown: 'página',
};

/**
 * ¿SEO Jump debe ofrecer FAQPage Schema como siguiente paso automático?
 *
 * - Categoría / entrada / home / producto → NO (el cierre AEO es contenido;
 *   en producto el Schema típico es Product).
 * - Página genérica con FAQ visibles → sí (opt-in razonable).
 * - unknown → no (mejor no empujar código técnico si no sabemos el tipo).
 */
export function shouldAutoOfferFaqSchema(pageType: string | null | undefined): boolean {
  const t = String(pageType || 'unknown').toLowerCase();
  return t === 'page';
}

/** ¿Corresponde empujar Product Schema en este tipo? */
export function shouldAutoOfferProductSchema(pageType: string | null | undefined): boolean {
  return String(pageType || '').toLowerCase() === 'product';
}

/** ¿El trabajo AEO “humano” (preguntas visibles) es el cierre principal? */
export function aeoEndsAtVisibleContent(pageType: string | null | undefined): boolean {
  const t = String(pageType || 'unknown').toLowerCase();
  return t === 'category' || t === 'post' || t === 'home' || t === 'unknown';
}

export function pageTypeLabel(pageType: string | null | undefined): string {
  const t = String(pageType || 'unknown').toLowerCase() as AeoPageType;
  return AEO_PAGE_TYPE_LABELS[t] || AEO_PAGE_TYPE_LABELS.unknown;
}

/**
 * Refina el tipo con señales Schema ya detectadas (CollectionPage → categoría).
 */
export function refinePageTypeWithSchema(
  pageType: string | null | undefined,
  schemaTypes: string[] | null | undefined
): AeoPageType {
  const types = (schemaTypes || []).map((s) => String(s).toLowerCase());
  if (types.includes('product')) return 'product';
  if (types.includes('collectionpage') || types.includes('itemlist')) {
    // Si la URL ya decía producto, no pisar; si no, categoría/listado.
    if (String(pageType || '') === 'product') return 'product';
    return 'category';
  }
  if (types.includes('article') || types.includes('blogposting')) return 'post';
  const t = String(pageType || 'unknown').toLowerCase();
  if (t in AEO_PAGE_TYPE_LABELS) return t as AeoPageType;
  return 'unknown';
}

/** Copy corto para UI / gaps: qué hacer según tipo. */
export function aeoNextStepCopy(pageType: string | null | undefined): {
  contentFirst: string;
  schemaLater: string;
} {
  const label = pageTypeLabel(pageType);
  if (aeoEndsAtVisibleContent(pageType)) {
    return {
      contentFirst: `En una ${label}, el trabajo AEO principal es responder bien las preguntas del usuario con texto visible (útil y específico).`,
      schemaLater:
        'No hace falta FAQPage Schema como siguiente paso automático. Cuando el contenido esté sólido, el Schema técnico es opcional y va por plugin SEO / HTML seguro — nunca en la descripción de una categoría.',
    };
  }
  if (shouldAutoOfferProductSchema(pageType)) {
    return {
      contentFirst:
        'En un producto, primero asegurá que la ficha responda lo que pregunta quien compra (para qué sirve, para quién, diferencias).',
      schemaLater:
        'Cuando el contenido esté claro, el cierre técnico típico es Product Schema (no pegar FAQPage en la descripción).',
    };
  }
  return {
    contentFirst: 'Primero el contenido útil y visible para humanos e IA.',
    schemaLater: 'Después, si corresponde, datos estructurados técnicos (Schema).',
  };
}
