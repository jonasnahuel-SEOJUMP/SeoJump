/**
 * Snapshot del Espía de la Competencia: on-page SEO + señales AEO (FAQ / Schema).
 * Un solo fetch de HTML → título, H1, headings, preguntas y Schema.org.
 * Separado de scraping.ts para no crear ciclo con comprehension.ts.
 */

import type { CompetitorSnapshot } from './supabase';
import { fetchPage, isUiNavigationHeading } from './scraping';
import { decodeHtmlEntities } from './textUtils';
import {
  extractFaqPairs,
  extractExistingStructuredData,
  buildFaqJsonLd,
  type FaqPair,
} from './comprehension';

export type SpyAeoSignals = {
  faqQuestions: string[];
  faqPairs: FaqPair[];
  hasFaqSchema: boolean;
  schemaTypes: string[];
};

export type SpyGapEnriched = {
  area: string;
  problem: string;
  suggestion: string;
  /** Código Schema FAQ listo para pegar (si aplica). */
  schemaCode?: string;
  /** Nota / instrucción sobre el Schema. */
  schemaNote?: string;
  /** Preguntas del rival que el usuario todavía no responde. */
  questionsToAdd?: string[];
  /** Si true, "Ya lo apliqué" debe verificar en vivo (no honor system). */
  requiresLiveVerify?: boolean;
  verifyKind?: 'schema_faq' | 'schema_product' | 'faq_visible' | 'honor';
  /** Gap de Schema (código): va último y usa flujo por pasos en la UI. */
  isSchemaGap?: boolean;
  schemaKind?: 'faq' | 'product';
};

/** Extrae señales AEO (FAQ + Schema) desde HTML ya descargado. Pura / testeable. */
export function extractSpyAeoSignals(html: string, maxFaqs = 8): SpyAeoSignals {
  if (!html) {
    return { faqQuestions: [], faqPairs: [], hasFaqSchema: false, schemaTypes: [] };
  }
  const faqs = extractFaqPairs(html, maxFaqs);
  const structured = extractExistingStructuredData(html);
  return {
    faqQuestions: faqs.map((f) => f.question),
    faqPairs: faqs,
    hasFaqSchema: structured.hasFaqPage,
    schemaTypes: structured.typesFound.slice(0, 10),
  };
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractHeadings(html: string, max = 8): string[] {
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h[23]>/gi;
  const out: string[] = [];
  const seen = new Set<string>();
  let match;
  while ((match = re.exec(cleaned)) !== null && out.length < max) {
    const text = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, '').trim());
    if (!text || isUiNavigationHeading(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.slice(0, 160));
  }
  return out;
}

/**
 * Scrapea un sitio y arma el snapshot completo del Espía
 * (título, H1, headings + FAQ + Schema) con un solo fetch.
 */
export async function buildCompetitorSnapshot(url: string): Promise<CompetitorSnapshot> {
  const empty: CompetitorSnapshot = {
    title: '',
    h1: '',
    headings: [],
    scrapedAt: new Date().toISOString(),
    faqQuestions: [],
    faqPairs: [],
    hasFaqSchema: false,
    schemaTypes: [],
  };

  if (!url?.trim()) return empty;

  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const page = await fetchPage(targetUrl);
  if (!page.ok || !page.html) return empty;

  const aeo = extractSpyAeoSignals(page.html);
  return {
    title: extractTitle(page.html),
    h1: extractH1(page.html),
    headings: extractHeadings(page.html),
    scrapedAt: new Date().toISOString(),
    faqQuestions: aeo.faqQuestions,
    faqPairs: aeo.faqPairs,
    hasFaqSchema: aeo.hasFaqSchema,
    schemaTypes: aeo.schemaTypes,
  };
}

function normQ(q: string): string {
  return q.trim().toLowerCase();
}

export function isSchemaGapArea(area: string): boolean {
  return /schema/i.test(area || '');
}

export function isFaqGapArea(area: string): boolean {
  return /pregunta|faq/i.test(area || '');
}

/** ¿El gap de Schema se refiere a Product (no a FAQ)? Se decide por el texto. */
export function isProductSchemaGap(area: string, problem: string, suggestion: string): boolean {
  const txt = `${area} ${problem} ${suggestion}`.toLowerCase();
  const mentionsProduct = /\bproduct\b|\bproducto\b/.test(txt);
  const mentionsFaq = /faq|pregunta/.test(txt);
  return mentionsProduct && !mentionsFaq;
}

/**
 * Enriquece gaps del Espía con código Schema copiable y metadatos de verificación.
 * - Schema AEO: si el usuario ya tiene FAQ visibles sin Schema → genera el JSON-LD.
 * - Si no tiene FAQ visibles → lista preguntas del rival a agregar primero (sin inventar respuestas).
 */
export function enrichSpyGaps(
  gaps: Array<{ area: string; problem: string; suggestion: string }>,
  own: CompetitorSnapshot | null,
  rival: CompetitorSnapshot
): SpyGapEnriched[] {
  const ownPairs = own?.faqPairs || [];
  const ownQs = new Set((own?.faqQuestions || []).map(normQ));
  const rivalQs = rival.faqQuestions || [];
  const questionsToAdd = rivalQs.filter((q) => !ownQs.has(normQ(q))).slice(0, 5);

  const enriched = gaps.map((g) => {
    const out: SpyGapEnriched = {
      area: g.area,
      problem: g.problem,
      suggestion: g.suggestion,
      verifyKind: 'honor',
      requiresLiveVerify: false,
    };

    if (isSchemaGapArea(g.area)) {
      out.requiresLiveVerify = true;
      out.isSchemaGap = true;

      // Schema de Producto (precio, disponibilidad, etc.) — distinto de FAQ.
      if (isProductSchemaGap(g.area, g.problem, g.suggestion)) {
        out.verifyKind = 'schema_product';
        out.schemaKind = 'product';
        out.schemaNote =
          'Último paso: generamos el código con los datos de tu página (sin precio, para que no quede desactualizado). Si tu tienda ya lo pone, lo confirmamos y listo.';
        return out;
      }

      out.verifyKind = 'schema_faq';
      out.schemaKind = 'faq';
      out.questionsToAdd = questionsToAdd.length ? questionsToAdd : undefined;
      out.schemaNote =
        'Este es el ÚLTIMO paso. Primero asegurate de tener las preguntas visibles en tu página; después generamos el código Schema para pegar.';
      // Si ya tiene FAQ visibles, adelantamos el código.
      if (!own?.hasFaqSchema && ownPairs.length >= 1) {
        out.schemaCode = buildFaqJsonLd(ownPairs);
      }
      return out;
    }

    if (isFaqGapArea(g.area)) {
      out.requiresLiveVerify = true;
      out.verifyKind = 'faq_visible';
      if (questionsToAdd.length) {
        out.questionsToAdd = questionsToAdd;
      }
      return out;
    }

    return out;
  });

  // Orden lógico: primero título/H1/contenido, el Schema (código) SIEMPRE al final.
  const rank = (g: SpyGapEnriched) => {
    if (g.isSchemaGap) return 3;
    if (g.verifyKind === 'faq_visible') return 2;
    return 1; // título, H1, intención, temas
  };
  return enriched
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i)
    .map(({ g }) => g);
}
