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
  verifyKind?: 'schema_faq' | 'faq_visible' | 'honor';
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

  return gaps.map((g) => {
    const out: SpyGapEnriched = {
      area: g.area,
      problem: g.problem,
      suggestion: g.suggestion,
      verifyKind: 'honor',
      requiresLiveVerify: false,
    };

    if (isSchemaGapArea(g.area)) {
      out.requiresLiveVerify = true;
      out.verifyKind = 'schema_faq';
      out.questionsToAdd = questionsToAdd.length ? questionsToAdd : undefined;

      if (own?.hasFaqSchema) {
        out.schemaNote =
          'En el scrape anterior no vimos Schema FAQ, pero si ya lo pegaste, tocá verificar y lo confirmamos en vivo.';
      } else if (ownPairs.length >= 1) {
        out.schemaCode = buildFaqJsonLd(ownPairs);
        out.schemaNote =
          'Copiá este bloque y pegalo en el HTML de tu página (antes de </body>). Si usás WordPress/Shopify, mirá la guía del Mapa de comprensión.';
      } else {
        out.schemaNote =
          'Todavía no detectamos preguntas con respuesta en tu página. Primero agregá las FAQ visibles (texto que se ve); después volvé a espiar o usá el Mapa de comprensión para generar el Schema.';
        if (questionsToAdd.length) {
          out.questionsToAdd = questionsToAdd;
        }
      }
      return out;
    }

    if (isFaqGapArea(g.area)) {
      out.requiresLiveVerify = true;
      out.verifyKind = 'faq_visible';
      if (questionsToAdd.length) {
        out.questionsToAdd = questionsToAdd;
      }
      // Si ya tiene FAQ visibles pero sin schema, ofrecer el código como bonus en gaps FAQ
      if (ownPairs.length >= 1 && !own?.hasFaqSchema) {
        out.schemaCode = buildFaqJsonLd(ownPairs);
        out.schemaNote =
          'Cuando tengas las preguntas en la página, pegá también este Schema FAQPage para que Google y las IA las lean.';
      }
      return out;
    }

    return out;
  });
}
