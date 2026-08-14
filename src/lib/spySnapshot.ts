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
  buildFaqVisibleHtml,
  buildFaqVisiblePlain,
  resolvePageType,
  type FaqPair,
} from './comprehension';
import {
  shouldAutoOfferFaqSchema,
  aeoEndsAtVisibleContent,
  aeoNextStepCopy,
  pageTypeLabel,
  refinePageTypeWithSchema,
} from './aeoSchemaPolicy';

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
  /** JSON-LD puro (sin <script>) — más seguro de copiar / mostrar. */
  schemaJson?: string;
  /** HTML visible de FAQ (H2/H3/p) — sí se puede pegar en descripción de categoría. */
  faqContentHtml?: string;
  /** Misma FAQ en texto plano. */
  faqContentPlain?: string;
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
  /**
   * El propio snapshot ya tiene este Schema (normalmente lo puso la
   * plataforma/plugin, no el usuario). La IA comparó igual y sugirió el gap
   * por error: no hay que "implementar" nada, solo avisarlo.
   */
  alreadySatisfied?: boolean;
  /**
   * No pudimos leer la página propia al espiar (fetch fallido/vacío), así que
   * NO sabemos con certeza si ya tenés este Schema. No afirmamos "no lo tenés":
   * lo confirmamos en vivo al generar/verificar.
   */
  ownUnreadable?: boolean;
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

  // Reintento con más tiempo: WooCommerce/Elementor y sitios lentos suelen
  // fallar el primer fetch. Cuando eso pasaba con la página PROPIA, no
  // detectábamos su Schema y el Espía ofrecía "implementar" algo que ya estaba.
  let page = await fetchPage(targetUrl, { timeoutMs: 6000 });
  if (!page.ok || !page.html) {
    page = await fetchPage(targetUrl, { timeoutMs: 10000 });
  }
  if (!page.ok || !page.html) return empty;

  const aeo = extractSpyAeoSignals(page.html);
  const pageType = refinePageTypeWithSchema(
    resolvePageType(page.html, targetUrl),
    aeo.schemaTypes
  );
  return {
    title: extractTitle(page.html),
    h1: extractH1(page.html),
    headings: extractHeadings(page.html),
    scrapedAt: new Date().toISOString(),
    faqQuestions: aeo.faqQuestions,
    faqPairs: aeo.faqPairs,
    hasFaqSchema: aeo.hasFaqSchema,
    schemaTypes: aeo.schemaTypes,
    pageType,
  };
}

function normQ(q: string): string {
  return q.trim().toLowerCase();
}

/** Arma pares Q&A para el bloque de contenido visible (prioriza respuestas del rival). */
function pairsForVisibleContent(
  questions: string[],
  rivalPairs: FaqPair[],
  ownPairs: FaqPair[]
): Array<{ question: string; answer?: string }> {
  const byQ = new Map<string, string>();
  for (const p of [...rivalPairs, ...ownPairs]) {
    const k = normQ(p.question);
    if (k && p.answer) byQ.set(k, p.answer);
  }
  return (questions || []).filter(Boolean).map((q) => ({
    question: q,
    answer: byQ.get(normQ(q)) || '',
  }));
}

function attachFaqContent(
  out: SpyGapEnriched,
  pairs: Array<{ question: string; answer?: string }>,
  heading?: string
) {
  if (!pairs.length) return;
  out.faqContentHtml = buildFaqVisibleHtml(pairs, { heading });
  out.faqContentPlain = buildFaqVisiblePlain(pairs, { heading });
}

function attachSchemaCode(out: SpyGapEnriched, pairs: FaqPair[]) {
  if (!pairs.length) return;
  out.schemaCode = buildFaqJsonLd(pairs); // con <script> (compat verify/copy avanzado)
  out.schemaJson = buildFaqJsonLd(pairs, { wrapScript: false });
}

export function isSchemaGapArea(area: string): boolean {
  return /schema/i.test(area || '');
}

export function isFaqGapArea(area: string): boolean {
  return /pregunta|faq/i.test(area || '');
}

/**
 * La IA a menudo nombra el gap "Intención de búsqueda" o "Contenido/Temas"
 * aunque la acción sea "agregá preguntas frecuentes". Esos deben verificarse
 * en vivo (faq_visible), no con honor system.
 */
export function gapSuggestsAddingFaqs(area: string, problem: string, suggestion: string): boolean {
  if (isFaqGapArea(area)) return true;
  const txt = `${area} ${problem} ${suggestion}`.toLowerCase();
  const mentionsFaq = /pregunta(?:s)?\s+frecuentes|\bfaqs?\b|preguntas?\s+comunes|preguntas?\s+que/.test(txt);
  const asksToAdd = /agreg|sumá|suma |identificá|escrib|respond|incluí|incluir|poné|poner/.test(txt);
  return mentionsFaq && asksToAdd;
}

/** ¿El gap de Schema se refiere a Product (no a FAQ)? Se decide por el texto. */
export function isProductSchemaGap(area: string, problem: string, suggestion: string): boolean {
  const txt = `${area} ${problem} ${suggestion}`.toLowerCase();
  const mentionsProduct = /\bproduct\b|\bproducto\b/.test(txt);
  const mentionsFaq = /faq|pregunta/.test(txt);
  return mentionsProduct && !mentionsFaq;
}

/**
 * Enriquece gaps del Espía con contenido AEO visible y Schema solo si la
 * política por tipo de URL lo permite (categoría ≠ FAQPage automático).
 */
export function enrichSpyGaps(
  gaps: Array<{ area: string; problem: string; suggestion: string }>,
  own: CompetitorSnapshot | null,
  rival: CompetitorSnapshot,
  opts?: { ownPageType?: string | null }
): SpyGapEnriched[] {
  const ownPairs = own?.faqPairs || [];
  const ownQs = new Set((own?.faqQuestions || []).map(normQ));
  const rivalQs = rival.faqQuestions || [];
  const questionsToAdd = rivalQs.filter((q) => !ownQs.has(normQ(q))).slice(0, 5);

  const ownPageType = refinePageTypeWithSchema(
    opts?.ownPageType || own?.pageType || 'unknown',
    own?.schemaTypes
  );
  const allowFaqSchema = shouldAutoOfferFaqSchema(ownPageType);
  const endsAtContent = aeoEndsAtVisibleContent(ownPageType);
  const typeLabel = pageTypeLabel(ownPageType);
  const nextCopy = aeoNextStepCopy(ownPageType);

  // ¿Pudimos leer la página propia? Si el snapshot vino vacío (fetch fallido),
  // no sabemos si ya tiene el Schema: no debemos afirmar "no lo tenés".
  const ownReadable = !!(
    own &&
    (own.title ||
      own.h1 ||
      (own.headings?.length ?? 0) > 0 ||
      (own.faqQuestions?.length ?? 0) > 0 ||
      (own.schemaTypes?.length ?? 0) > 0)
  );
  const OWN_UNREADABLE_NOTE =
    'Ojo: no pudimos leer tu página al espiar, así que no confirmamos si ya tenés este Schema. ' +
    'Cuando toques generar/verificar lo chequeamos en vivo; si tu plataforma o plugin ya lo genera, ' +
    'te lo marcamos como "ya lo tenías" sin pedirte pegar nada.';

  // ¿La IA ya generó un gap de Schema FAQ? (solo cuenta si la política lo permite)
  const hasFaqSchemaGapAlready =
    allowFaqSchema &&
    gaps.some(
      (g) => isSchemaGapArea(g.area) && !isProductSchemaGap(g.area, g.problem, g.suggestion)
    );

  const enriched = gaps.map((g) => {
    const out: SpyGapEnriched = {
      area: g.area,
      problem: g.problem,
      suggestion: g.suggestion,
      verifyKind: 'honor',
      requiresLiveVerify: false,
    };

    if (isSchemaGapArea(g.area)) {
      // Schema Product — válido sobre todo en fichas de producto.
      if (isProductSchemaGap(g.area, g.problem, g.suggestion)) {
        out.requiresLiveVerify = true;
        out.isSchemaGap = true;
        out.verifyKind = 'schema_product';
        out.schemaKind = 'product';
        const ownTypes = (own?.schemaTypes || []).map((t) => t.toLowerCase());
        if (ownTypes.includes('product')) {
          out.alreadySatisfied = true;
          out.problem =
            'Ya tenés el Schema Product en tu página. La comparación lo marcó como brecha, pero al chequear tu HTML en vivo, ya está.';
          out.suggestion = '';
          out.schemaNote =
            'No hace falta hacer nada: tu plataforma o plugin SEO ya lo genera automáticamente.';
        } else if (!ownReadable) {
          out.ownUnreadable = true;
          out.schemaNote = OWN_UNREADABLE_NOTE;
        } else {
          out.schemaNote =
            'Cierre técnico de un producto: Product Schema (invisible). No confundir con FAQPage ni pegarlo en la descripción de una categoría.';
        }
        return out;
      }

      // Schema FAQPage — la IA a menudo lo pide en categorías; la política lo frena.
      if (!allowFaqSchema) {
        out.isSchemaGap = false;
        out.verifyKind = 'faq_visible';
        out.requiresLiveVerify = true;
        out.area = endsAtContent ? `Contenido útil · ${typeLabel}` : g.area;
        out.problem =
          ownReadable && (own?.faqQuestions?.length ?? 0) > 0
            ? `Tu ${typeLabel} ya tiene preguntas visibles. ${nextCopy.contentFirst}`
            : `Esta ${typeLabel} necesita más información útil que responda lo que pregunta tu usuario — no un bloque técnico FAQPage.`;
        out.suggestion = questionsToAdd.length
          ? 'Copiá el contenido AEO (HTML) y pegalo en la descripción/contenido de la página. Después verificamos en vivo.'
          : 'Mejorá el texto visible con respuestas concretas. El Schema FAQPage no es el siguiente paso automático acá.';
        out.questionsToAdd = questionsToAdd.length ? questionsToAdd : undefined;
        if (questionsToAdd.length) {
          attachFaqContent(
            out,
            pairsForVisibleContent(questionsToAdd, rival.faqPairs || [], ownPairs),
            'Preguntas frecuentes'
          );
        }
        out.schemaNote = nextCopy.schemaLater;
        // Si ya tiene contenido FAQ visible y no hay preguntas nuevas → listo.
        if (ownReadable && (own?.faqQuestions?.length ?? 0) > 0 && questionsToAdd.length === 0) {
          out.alreadySatisfied = true;
          out.requiresLiveVerify = false;
          out.problem = `Ya tenés ${(own?.faqQuestions?.length ?? 0)} pregunta(s) visibles en tu ${typeLabel}. Eso es el trabajo AEO principal acá.`;
          out.suggestion = '';
        }
        return out;
      }

      out.requiresLiveVerify = true;
      out.isSchemaGap = true;
      out.verifyKind = 'schema_faq';
      out.schemaKind = 'faq';
      if (own?.hasFaqSchema) {
        out.alreadySatisfied = true;
        out.problem =
          'Ya tenés el Schema FAQPage en tu página. La comparación lo marcó como brecha, pero al chequear tu HTML en vivo, ya está.';
        out.suggestion = '';
        out.schemaNote = 'No hace falta hacer nada más acá.';
        return out;
      }
      out.questionsToAdd = questionsToAdd.length ? questionsToAdd : undefined;
      if (!ownReadable) {
        out.ownUnreadable = true;
        out.schemaNote = OWN_UNREADABLE_NOTE;
      } else {
        out.schemaNote =
          'Paso técnico opcional: JSON-LD vía plugin SEO / HTML seguro. Primero el contenido visible. Nunca en la descripción de una categoría.';
      }
      if (questionsToAdd.length) {
        attachFaqContent(
          out,
          pairsForVisibleContent(questionsToAdd, rival.faqPairs || [], ownPairs),
          'Preguntas frecuentes'
        );
      }
      if (ownPairs.length >= 1) {
        attachSchemaCode(out, ownPairs);
      }
      return out;
    }

    if (isFaqGapArea(g.area) || gapSuggestsAddingFaqs(g.area, g.problem, g.suggestion)) {
      out.requiresLiveVerify = true;
      out.verifyKind = 'faq_visible';
      if (!isFaqGapArea(g.area) && gapSuggestsAddingFaqs(g.area, g.problem, g.suggestion)) {
        out.area = `${g.area} · Preguntas útiles`;
      }
      const ownFaqCount = own?.faqQuestions?.length ?? 0;

      if (ownReadable && ownFaqCount > 0 && questionsToAdd.length === 0) {
        if (own?.hasFaqSchema) {
          out.alreadySatisfied = true;
          out.requiresLiveVerify = false;
          out.problem = `Ya tenés ${ownFaqCount} pregunta(s) visibles y el Schema FAQPage. La comparación lo marcó como brecha, pero ya está.`;
          out.suggestion = '';
          out.schemaNote = 'No hace falta hacer nada más acá. ✅';
          return out;
        }
        // Contenido visible OK: en categoría/post/home NO empujar FAQ Schema.
        if (!allowFaqSchema || endsAtContent) {
          out.alreadySatisfied = true;
          out.requiresLiveVerify = false;
          out.problem = `Ya tenés ${ownFaqCount} pregunta(s) visibles en tu ${typeLabel}. ${nextCopy.contentFirst}`;
          out.suggestion = '';
          out.schemaNote = nextCopy.schemaLater;
          return out;
        }
        if (!hasFaqSchemaGapAlready && ownPairs.length >= 1) {
          out.isSchemaGap = true;
          out.schemaKind = 'faq';
          out.verifyKind = 'schema_faq';
          out.requiresLiveVerify = true;
          out.problem = `Ya tenés ${ownFaqCount} pregunta(s) visibles. El paso técnico opcional es el Schema FAQPage (JSON-LD), distinto del texto de las FAQ.`;
          out.suggestion =
            'Instalá el JSON-LD con Rank Math / Yoast / HTML seguro. No lo pegues en la descripción de una categoría.';
          attachSchemaCode(out, ownPairs);
          out.schemaNote =
            'El Schema es invisible para visitantes. No va en la descripción de WordPress (Wordfence lo bloquea).';
          return out;
        }
        out.alreadySatisfied = true;
        out.requiresLiveVerify = false;
        out.problem = `Ya tenés ${ownFaqCount} pregunta(s) visibles en tu página.`;
        out.suggestion = '';
        out.schemaNote = nextCopy.schemaLater;
        return out;
      }

      if (questionsToAdd.length) {
        out.questionsToAdd = questionsToAdd;
        attachFaqContent(
          out,
          pairsForVisibleContent(questionsToAdd, rival.faqPairs || [], ownPairs),
          'Preguntas frecuentes'
        );
        if (ownReadable && ownFaqCount > 0) {
          out.problem = `Ya tenés ${ownFaqCount} pregunta(s) visibles, pero el competidor cubre otras que te conviene sumar (más útiles / más específicas).`;
        } else {
          out.problem =
            out.problem ||
            `Tu ${typeLabel} todavía no responde suficientemente bien las preguntas que probablemente tiene tu usuario.`;
          out.suggestion =
            'Copiá el bloque de contenido AEO (HTML) y pegalo en la descripción/contenido. Eso es el trabajo principal. Después verificamos en vivo.';
        }
        out.schemaNote = endsAtContent ? nextCopy.schemaLater : undefined;
      }
      return out;
    }

    return out;
  });

  const rank = (g: SpyGapEnriched) => {
    if (g.isSchemaGap) return 3;
    if (g.verifyKind === 'faq_visible') return 2;
    return 1;
  };
  return enriched
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i)
    .map(({ g }) => g);
}
