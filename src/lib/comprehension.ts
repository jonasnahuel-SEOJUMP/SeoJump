/**
 * Mapa de comprensión AEO — detector determinístico (sin IA).
 * Responde: ¿qué entendería Google/una IA de esta página? ¿qué falta?
 * El Schema (JSON-LD) es solo la traducción opcional del Nivel 2 → Nivel 3.
 */

import { detectPageTypeFromHtml } from './scraping';
import { decodeHtmlEntities } from './textUtils';

export type ComprehensionPageType =
  | 'product'
  | 'post'
  | 'category'
  | 'home'
  | 'page'
  | 'unknown';

export type ComprehensionCheckId =
  | 'pageType'
  | 'entities'
  | 'questions'
  | 'author'
  | 'organization'
  | 'date'
  | 'price'
  | 'faqStructure';

export type ComprehensionCheck = {
  id: ComprehensionCheckId;
  label: string;
  present: boolean;
  detail: string;
  /** Relevancia: si false, no penaliza el score (ej. precio en un blog). */
  applicable: boolean;
};

export type FaqPair = {
  question: string;
  answer: string;
};

export type ExistingStructuredData = {
  hasFaqPage: boolean;
  hasProduct: boolean;
  hasArticle: boolean;
  hasOrganization: boolean;
  hasLocalBusiness: boolean;
  typesFound: string[];
};

export type ComprehensionMap = {
  pageUrl: string;
  pageType: ComprehensionPageType;
  pageTypeLabel: string;
  title: string;
  h1: string;
  entities: string[];
  questions: FaqPair[];
  checks: ComprehensionCheck[];
  confidence: 'bajo' | 'medio' | 'alto';
  confidenceScore: number;
  headline: string;
  existingStructured: ExistingStructuredData;
  /** Si true, conviene ofrecer "Generar estructura para IA" (FAQ). */
  canOfferFaqStructure: boolean;
  /** Si ya hay FAQ estructurado, no ofrecer duplicar. */
  faqStructureAlreadyPresent: boolean;
};

const PAGE_TYPE_LABELS: Record<ComprehensionPageType, string> = {
  product: 'Producto',
  post: 'Artículo / blog',
  category: 'Categoría de tienda',
  home: 'Página de inicio',
  page: 'Página',
  unknown: 'Página (tipo poco claro)',
};

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]) : '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? stripTags(m[1]) : '';
}

function pageTypeFromUrl(pageUrl: string): ComprehensionPageType {
  try {
    const lower = pageUrl.toLowerCase();
    const path = new URL(lower.startsWith('http') ? lower : `https://${lower}`).pathname;
    if (path === '/' || path === '') return 'home';
    if (/categoria-producto|product-category|\/categorias?\//.test(path)) return 'category';
    if (/\/producto\/|\/product\//.test(path)) return 'product';
    if (/\/blog\/|\/noticia|\/articulo/.test(path)) return 'post';
  } catch {
    /* ignore */
  }
  return 'unknown';
}

export function resolvePageType(html: string, pageUrl: string): ComprehensionPageType {
  const fromHtml = detectPageTypeFromHtml(html) as ComprehensionPageType | '';
  if (fromHtml && fromHtml in PAGE_TYPE_LABELS) return fromHtml;
  return pageTypeFromUrl(pageUrl);
}

/** Extrae tipos presentes en scripts application/ld+json. */
export function extractExistingStructuredData(html: string): ExistingStructuredData {
  const typesFound: string[] = [];
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(html)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      collectTypes(parsed, typesFound);
    } catch {
      // JSON roto frecuente en WP; buscar @type a ojo
      const loose = raw.match(/"@type"\s*:\s*"([^"]+)"/gi) || [];
      for (const t of loose) {
        const name = t.replace(/.*"@type"\s*:\s*"/i, '').replace(/".*/, '');
        if (name) typesFound.push(name);
      }
    }
  }
  const lower = typesFound.map((t) => t.toLowerCase());
  return {
    hasFaqPage: lower.some((t) => t === 'faqpage'),
    hasProduct: lower.some((t) => t === 'product'),
    hasArticle: lower.some((t) => t === 'article' || t === 'blogposting'),
    hasOrganization: lower.some((t) => t === 'organization'),
    hasLocalBusiness: lower.some((t) => t.includes('localbusiness') || t === 'store'),
    typesFound: [...new Set(typesFound)],
  };
}

function collectTypes(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj['@type'] === 'string') out.push(obj['@type']);
  if (Array.isArray(obj['@type'])) {
    for (const t of obj['@type']) if (typeof t === 'string') out.push(t);
  }
  if (obj['@graph']) collectTypes(obj['@graph'], out);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectTypes(v, out);
  }
}

/**
 * Preguntas reales en la página: H2/H3 con "?" + párrafo siguiente.
 * También acepta dt/dd o bloques con clase faq.
 */
export function extractFaqPairs(html: string, maxPairs = 12): FaqPair[] {
  const pairs: FaqPair[] = [];
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(html)) !== null && pairs.length < maxPairs) {
    const question = stripTags(m[2]);
    if (!question.includes('?') && !question.includes('¿')) continue;
    if (question.length < 8 || question.length > 180) continue;

    const after = html.slice(m.index + m[0].length);
    const nextHeading = after.search(/<h[1-6][\s>]/i);
    const slice = nextHeading === -1 ? after.slice(0, 2500) : after.slice(0, nextHeading);
    const pMatch = slice.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let answer = pMatch ? stripTags(pMatch[1]) : '';
    if (!answer || answer.length < 20) {
      // fallback: texto plano del bloque
      answer = stripTags(slice).slice(0, 400);
    }
    if (answer.length < 20) continue;
    pairs.push({ question, answer: answer.slice(0, 500) });
  }
  return pairs;
}

export function detectAuthor(html: string): { present: boolean; detail: string } {
  if (/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i.test(html) ||
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i.test(html)) {
    const m =
      html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']author["']/i);
    return { present: true, detail: `Autor detectado: ${m?.[1]?.trim() || 'sí'}` };
  }
  if (/rel=["']author["']/i.test(html) || /class=["'][^"']*author[^"']*["']/i.test(html)) {
    return { present: true, detail: 'Hay un bloque de autor en la página.' };
  }
  if (/"@type"\s*:\s*"Person"/i.test(html)) {
    return { present: true, detail: 'Hay una persona identificada en los datos de la página.' };
  }
  const text = stripTags(html).toLowerCase();
  if (/\b(escrito por|por el equipo|autor:)\b/.test(text)) {
    return { present: true, detail: 'El texto menciona un autor.' };
  }
  return { present: false, detail: 'No queda claro quién escribió o responde por esta página.' };
}

export function detectOrganization(html: string, title: string): { present: boolean; detail: string } {
  if (/"@type"\s*:\s*"Organization"/i.test(html) || /"@type"\s*:\s*"LocalBusiness"/i.test(html)) {
    return { present: true, detail: 'La página identifica la empresa/organización.' };
  }
  // Título "Algo | NombreTienda" suele llevar marca
  const parts = title.split(/\s*[|–—]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[parts.length - 1].length >= 3) {
    return {
      present: true,
      detail: `Marca/tienda aparente en el título: «${parts[parts.length - 1]}».`,
    };
  }
  if (/itemprop=["']name["']/i.test(html) && /Organization/i.test(html)) {
    return { present: true, detail: 'Hay nombre de organización en la página.' };
  }
  return { present: false, detail: 'No queda clara la empresa responsable de este contenido.' };
}

export function detectDate(html: string): { present: boolean; detail: string } {
  if (/article:published_time|article:modified_time|og:updated_time/i.test(html)) {
    return { present: true, detail: 'Hay fecha de publicación o actualización.' };
  }
  if (/<time[^>]+datetime=["'][^"']+["']/i.test(html)) {
    return { present: true, detail: 'Hay una fecha marcada en el contenido.' };
  }
  if (/"datePublished"|"dateModified"/i.test(html)) {
    return { present: true, detail: 'Hay fecha en los datos estructurados.' };
  }
  return { present: false, detail: 'No hay una fecha clara de publicación o actualización.' };
}

export function detectPrice(html: string): { present: boolean; detail: string } {
  if (/itemprop=["']price["']|woocommerce-Price-amount|"price"\s*:/i.test(html)) {
    return { present: true, detail: 'Hay precio visible o marcado.' };
  }
  const text = stripTags(html);
  if (/\$\s?\d+|\d+[.,]\d{2}\s*(ars|usd|€)/i.test(text)) {
    return { present: true, detail: 'Se detectaron montos/precios en el texto.' };
  }
  return { present: false, detail: 'No se ve un precio claro.' };
}

/** Entidades simples: segmentos del título/H1 + marcas Capitalizadas. */
export function extractEntities(title: string, h1: string, max = 8): string[] {
  const source = [h1, title].filter(Boolean).join(' | ');
  if (!source) return [];

  const chunks = source
    .split(/\s*[|–—•]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3 && s.length <= 60);

  const entities: string[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks) {
    const key = chunk.toLowerCase();
    if (seen.has(key)) continue;
    // Evitar chunks que son solo "home" genéricos
    if (/^(inicio|home|tienda|shop)$/i.test(chunk)) continue;
    seen.add(key);
    entities.push(chunk);
    if (entities.length >= max) break;
  }

  // Tokens Capitalizados multi-palabra (Black Line, Toxic Shine)
  const brandRe = /\b([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ]+){0,2})\b/g;
  let bm;
  const pool = `${h1} ${title}`;
  while ((bm = brandRe.exec(pool)) !== null && entities.length < max) {
    const name = bm[1].trim();
    if (name.length < 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (/^(Qué|Como|Cómo|Para|Esta|Este|Tu|El|La|Los|Las)$/i.test(name)) continue;
    seen.add(key);
    entities.push(name);
  }

  return entities.slice(0, max);
}

export function buildFaqJsonLd(pairs: FaqPair[]): string {
  const mainEntity = pairs.map((p) => ({
    '@type': 'Question',
    name: p.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: p.answer,
    },
  }));
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity,
  };
  return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

function computeConfidence(checks: ComprehensionCheck[]): {
  confidence: 'bajo' | 'medio' | 'alto';
  confidenceScore: number;
} {
  const applicable = checks.filter((c) => c.applicable);
  if (applicable.length === 0) return { confidence: 'bajo', confidenceScore: 0 };
  const passed = applicable.filter((c) => c.present).length;
  const score = Math.round((passed / applicable.length) * 100);
  const confidence = score >= 70 ? 'alto' : score >= 45 ? 'medio' : 'bajo';
  return { confidence, confidenceScore: score };
}

function buildHeadline(
  confidence: 'bajo' | 'medio' | 'alto',
  pageTypeLabel: string,
  missing: string[]
): string {
  if (confidence === 'alto') {
    return `Una IA entendería bien que esto es ${pageTypeLabel.toLowerCase()}. Quedan pocos huecos.`;
  }
  if (confidence === 'medio') {
    const gap = missing[0] ? ` Falta: ${missing[0].toLowerCase()}.` : '';
    return `Se entiende a medias.${gap}`;
  }
  const gap = missing.slice(0, 2).join('; ');
  return gap
    ? `Todavía hay ambigüedad. Priorizá: ${gap.toLowerCase()}.`
    : 'Todavía hay mucha ambigüedad para Google y las IA.';
}

/**
 * Análisis completo de comprensión a partir del HTML en vivo.
 */
export function analyzeComprehension(html: string, pageUrl: string): ComprehensionMap {
  const pageType = resolvePageType(html, pageUrl);
  const pageTypeLabel = PAGE_TYPE_LABELS[pageType];
  const title = extractTitle(html);
  const h1 = extractH1(html);
  const entities = extractEntities(title, h1);
  const questions = extractFaqPairs(html);
  const existingStructured = extractExistingStructuredData(html);
  const author = detectAuthor(html);
  const organization = detectOrganization(html, title);
  const date = detectDate(html);
  const price = detectPrice(html);

  const needsPrice = pageType === 'product';
  const needsAuthor = pageType === 'post' || pageType === 'page';
  const needsDate = pageType === 'post';

  const faqStructureAlreadyPresent = existingStructured.hasFaqPage;
  // Con 1+ pregunta ya generamos el bloque: para las IA una sola Q&A estructurada
  // ya ayuda. (Google prefiere 2+ para el resultado enriquecido; se avisa en la UI.)
  const canOfferFaqStructure = questions.length >= 1 && !faqStructureAlreadyPresent;

  const checks: ComprehensionCheck[] = [
    {
      id: 'pageType',
      label: 'Tipo de página claro',
      present: pageType !== 'unknown',
      detail:
        pageType === 'unknown'
          ? 'No queda claro si es producto, artículo, categoría u otra cosa.'
          : `Se entiende como: ${pageTypeLabel}.`,
      applicable: true,
    },
    {
      id: 'entities',
      label: 'Temas / marcas detectados',
      present: entities.length >= 1,
      detail:
        entities.length > 0
          ? `Temas aparentes: ${entities.slice(0, 5).join(', ')}.`
          : 'No hay temas o marcas claras en el título o encabezado.',
      applicable: true,
    },
    {
      id: 'questions',
      label: 'Preguntas que responde',
      present: questions.length >= 1 || faqStructureAlreadyPresent,
      detail: faqStructureAlreadyPresent
        ? 'Ya hay preguntas frecuentes en formato que Google/IA pueden leer.'
        : questions.length > 0
          ? `Encontramos ${questions.length} pregunta(s) con respuesta en el contenido.`
          : 'No hay preguntas frecuentes claras (¿Qué es…?, ¿Cómo…?).',
      applicable: true,
    },
    {
      id: 'author',
      label: 'Quién responde / autor',
      present: author.present,
      detail: author.detail,
      applicable: needsAuthor,
    },
    {
      id: 'organization',
      label: 'Empresa responsable',
      present: organization.present || existingStructured.hasOrganization || existingStructured.hasLocalBusiness,
      detail:
        existingStructured.hasOrganization || existingStructured.hasLocalBusiness
          ? 'La empresa ya está identificada para Google/IA.'
          : organization.detail,
      applicable: true,
    },
    {
      id: 'date',
      label: 'Fecha de publicación / actualización',
      present: date.present,
      detail: date.detail,
      applicable: needsDate,
    },
    {
      id: 'price',
      label: 'Precio visible',
      present: price.present || existingStructured.hasProduct,
      detail: existingStructured.hasProduct
        ? 'Hay datos de producto estructurados (incluye señales comerciales).'
        : price.detail,
      applicable: needsPrice,
    },
    {
      id: 'faqStructure',
      label: 'Preguntas en formato que la IA lee fácil',
      present: faqStructureAlreadyPresent,
      detail: faqStructureAlreadyPresent
        ? 'Las preguntas frecuentes ya están en un formato entendible para Google y las IA.'
        : canOfferFaqStructure
          ? questions.length === 1
            ? 'Detectamos 1 pregunta. Podés generar la estructura para que las IA la lean sin ambigüedad (para el resultado enriquecido de Google conviene sumar otra).'
            : `Tenés ${questions.length} preguntas en el texto. Podés generar la estructura lista para que Google/IA las lean sin ambigüedad.`
          : 'Todavía no hay un bloque de preguntas listo para Google/IA.',
      applicable: questions.length >= 1 || faqStructureAlreadyPresent,
    },
  ];

  const { confidence, confidenceScore } = computeConfidence(checks);
  const missing = checks
    .filter((c) => c.applicable && !c.present)
    .map((c) => c.label);

  return {
    pageUrl,
    pageType,
    pageTypeLabel,
    title,
    h1,
    entities,
    questions,
    checks,
    confidence,
    confidenceScore,
    headline: buildHeadline(confidence, pageTypeLabel, missing),
    existingStructured,
    canOfferFaqStructure,
    faqStructureAlreadyPresent,
  };
}

/** Texto guía CMS (sin jerga Schema) para pegar el bloque FAQ. */
export function getFaqStructurePasteGuide(platformId = 'wp_woo'): {
  title: string;
  steps: string[];
  copyLabel: string;
} {
  const isWp = platformId === 'wp_woo' || platformId === 'wp';
  return {
    title: 'Cómo pegar la estructura para que Google y las IA lean tus preguntas',
    copyLabel: 'Copiar código listo para pegar',
    steps: isWp
      ? [
          'En WordPress, abrí la página que analizaste.',
          'Agregá un bloque **HTML personalizado** al final (o usá el campo de código de Rank Math / Yoast si ya lo usás).',
          'Pegá el código copiado **tal cual**, sin editarlo.',
          'Publicá o actualizá la página y borrá la caché del sitio.',
          'Volvé a SEO Jump y tocá **Ya lo pegué** para verificar.',
        ]
      : [
          'Abrí el editor de esa página en tu plataforma.',
          'Buscá dónde se puede pegar un bloque HTML o “código en el pie de página”.',
          'Pegá el código copiado tal cual y guardá.',
          'Volvé a SEO Jump y tocá **Ya lo pegué** para verificar.',
        ],
  };
}
