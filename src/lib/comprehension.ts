/**
 * Mapa de comprensión AEO — detector determinístico (sin IA).
 * Responde: ¿qué entendería Google/una IA de esta página? ¿qué falta?
 * El Schema (JSON-LD) es solo la traducción opcional del Nivel 2 → Nivel 3.
 */

import { detectPageTypeFromHtml } from './scraping';
import { decodeHtmlEntities } from './textUtils';
import { shouldAutoOfferFaqSchema, shouldAutoOfferProductSchema } from './aeoSchemaPolicy';

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

export type StructuredOfferType = 'faq' | 'product' | 'article' | 'organization';

export type StructuredOffer = {
  type: StructuredOfferType;
  /** JSON-LD listo para pegar (históricamente con <script>; preferir codeJson en UI). */
  code: string;
  /** JSON-LD puro sin <script> (más seguro de copiar). */
  codeJson?: string;
  /** HTML visible de FAQ (solo type=faq) — sí se puede pegar en descripción. */
  contentHtml?: string;
  /** Título de la misión (sin jerga Schema). */
  missionTitle: string;
  /** Qué hace, en lenguaje simple. */
  description: string;
  /** Texto del botón de copiar. */
  copyLabel: string;
  /** Aviso opcional (ej. Google prefiere 2+ preguntas). */
  note?: string;
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
  /** Mejor estructura para ofrecer según el tipo de página (o null si ya está todo cubierto). */
  offer: StructuredOffer | null;
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

export function pageTypeFromUrl(pageUrl: string): ComprehensionPageType {
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

/** Normaliza @type: "https://schema.org/FAQPage" → "FAQPage". */
export function normalizeSchemaType(raw: string): string {
  const t = String(raw || '').trim();
  if (!t) return '';
  const cleaned = t
    .replace(/^https?:\/\/schema\.org\//i, '')
    .replace(/^schema:/i, '')
    .trim();
  // Conservar el nombre legible (última parte si viniera con path raro).
  const slash = cleaned.lastIndexOf('/');
  return (slash >= 0 ? cleaned.slice(slash + 1) : cleaned).trim();
}

function pushSchemaType(raw: string, out: string[]): void {
  const name = normalizeSchemaType(raw);
  if (name) out.push(name);
}

/** Extrae tipos presentes en scripts application/ld+json (+ microdata FAQ/Product). */
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
        if (name) pushSchemaType(name, typesFound);
      }
    }
  }

  // Microdata / RDFa (algunos plugins Woo no usan ld+json).
  const microRe =
    /itemtype=["'][^"']*(?:schema\.org\/)?(FAQPage|Product|Article|Organization|LocalBusiness)["']/gi;
  let micro;
  while ((micro = microRe.exec(html)) !== null) {
    pushSchemaType(micro[1], typesFound);
  }

  const lower = typesFound.map((t) => normalizeSchemaType(t).toLowerCase());
  return {
    hasFaqPage: lower.some((t) => t === 'faqpage'),
    hasProduct: lower.some((t) => t === 'product'),
    hasArticle: lower.some((t) => t === 'article' || t === 'blogposting'),
    hasOrganization: lower.some((t) => t === 'organization'),
    hasLocalBusiness: lower.some((t) => t.includes('localbusiness') || t === 'store'),
    typesFound: [...new Set(typesFound.map(normalizeSchemaType).filter(Boolean))],
  };
}

function collectTypes(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj['@type'] === 'string') pushSchemaType(obj['@type'], out);
  if (Array.isArray(obj['@type'])) {
    for (const t of obj['@type']) if (typeof t === 'string') pushSchemaType(t, out);
  }
  if (obj['@graph']) collectTypes(obj['@graph'], out);
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') collectTypes(v, out);
  }
}

/**
 * Preguntas reales en la página.
 * Prioriza H2/H3 con "?", y también detecta patrones típicos de WooCommerce:
 * negrita/strong, acordeones details/summary, dt/dd y bloques con clase faq.
 */
export function extractFaqPairs(html: string, maxPairs = 12): FaqPair[] {
  const pairs: FaqPair[] = [];
  const seen = new Set<string>();

  const pushPair = (questionRaw: string, answerRaw: string) => {
    if (pairs.length >= maxPairs) return;
    const question = stripTags(questionRaw).replace(/\s+/g, ' ').trim();
    const answer = stripTags(answerRaw).replace(/\s+/g, ' ').trim();
    if (!looksLikeQuestion(question)) return;
    if (answer.length < 20 || answer.length > 1200) return;
    // Evitar que la "respuesta" sea otra pregunta.
    if (looksLikeQuestion(answer.slice(0, 180))) return;
    const key = question.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ question: question.slice(0, 180), answer: answer.slice(0, 500) });
  };

  // 1) H2–H6 con interrogación + contenido hasta el próximo heading.
  // Muchas FAQ de WooCommerce/temas ponen las preguntas como <h4>/<h5>, no
  // solo <h2>/<h3>: si nos limitábamos a h2/h3 no las detectábamos.
  const headingRe = /<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(html)) !== null && pairs.length < maxPairs) {
    const after = html.slice(m.index + m[0].length);
    const nextHeading = after.search(/<h[1-6][\s>]/i);
    const slice = nextHeading === -1 ? after.slice(0, 2500) : after.slice(0, nextHeading);
    // Respuesta: primer párrafo si existe; si no, el bloque de texto siguiente.
    const pMatch = slice.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const answer = pMatch ? pMatch[1] : slice;
    pushPair(m[2], answer);
  }

  // 2) <details>/<summary> (acordeones nativos y muchos FAQs de temas)
  const detailsRe = /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  while ((m = detailsRe.exec(html)) !== null && pairs.length < maxPairs) {
    pushPair(m[1], m[2]);
  }

  // 3) <dt>/<dd> (listas de definición)
  const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  while ((m = dtRe.exec(html)) !== null && pairs.length < maxPairs) {
    pushPair(m[1], m[2]);
  }

  // 4) Negrita / strong / b como pregunta + respuesta en el mismo bloque o párrafo siguiente
  // Cubrey WooCommerce y editores que ponen FAQs en texto enriquecido sin H2/H3.
  const boldQuestionRe =
    /<(?:strong|b)[^>]*>\s*(¿[^<]{6,180}\?)\s*<\/(?:strong|b)>([\s\S]{0,1200}?)(?=<(?:strong|b|h[1-6]|details|dt)\b|$)/gi;
  while ((m = boldQuestionRe.exec(html)) !== null && pairs.length < maxPairs) {
    pushPair(m[1], m[2]);
  }

  // 5) Párrafo/div entero que es solo una pregunta, seguido de otro párrafo respuesta
  const questionParagraphRe =
    /<(p|div)[^>]*>\s*(¿[^<]{6,180}\?)\s*<\/\1>\s*<(p|div)[^>]*>([\s\S]*?)<\/\3>/gi;
  while ((m = questionParagraphRe.exec(html)) !== null && pairs.length < maxPairs) {
    pushPair(m[2], m[4]);
  }

  // 6) Pregunta en negrita DENTRO de un <p>, con respuesta en el mismo párrafo o el siguiente
  // Caso típico WooCommerce: <p><strong>¿…?</strong><br>respuesta</p>
  const boldInParagraphRe =
    /<p[^>]*>\s*<(?:strong|b)[^>]*>\s*(¿[^<]{6,180}\?)\s*<\/(?:strong|b)>\s*(?:<br\s*\/?>|\s)*([\s\S]*?)<\/p>/gi;
  while ((m = boldInParagraphRe.exec(html)) !== null && pairs.length < maxPairs) {
    let answer = m[2];
    if (stripTags(answer).replace(/\s+/g, ' ').trim().length < 20) {
      const after = html.slice(m.index + m[0].length);
      const nextP = after.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/i);
      if (nextP) answer = nextP[1];
    }
    pushPair(m[1], answer);
  }

  // 7) Títulos de acordeón típicos (Flatsome, temas Woo, etc.)
  const accordionTitleRe =
    /<(?:div|span|a|button|p)[^>]*(?:class|id)=["'][^"']*(?:accordion[-_ ]?title|accordion[-_ ]?header|toggle[-_ ]?title|faq[-_ ]?question|faq[-_ ]?title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span|a|button|p)>([\s\S]{0,1200}?)(?=<(?:div|span|a|button|p)[^>]*(?:class|id)=["'][^"']*(?:accordion[-_ ]?title|accordion[-_ ]?header|toggle[-_ ]?title|faq[-_ ]?question|faq[-_ ]?title)|$)/gi;
  while ((m = accordionTitleRe.exec(html)) !== null && pairs.length < maxPairs) {
    pushPair(m[1], m[2]);
  }

  return pairs;
}

function looksLikeQuestion(text: string): boolean {
  const q = text.replace(/\s+/g, ' ').trim();
  if (q.length < 8 || q.length > 180) return false;
  if (!(q.includes('?') || q.includes('¿'))) return false;
  // Evitar ruido de UI / navegación
  if (/añadir al carrito|vista rápida|iniciar sesión|crear una cuenta|mi cuenta/i.test(q)) {
    return false;
  }
  return true;
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

export function buildFaqJsonLd(pairs: FaqPair[], opts?: { wrapScript?: boolean }): string {
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
  // Por defecto seguimos envolviendo en <script> (compat). Para UI segura
  // preferimos JSON puro (wrapScript: false) — Wordfence no lo bloquea igual.
  if (opts?.wrapScript === false) {
    return JSON.stringify(payload, null, 2);
  }
  return wrapJsonLd(payload);
}

function escapeHtmlText(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Contenido AEO visible (sin <script>): listo para pegar en la descripción
 * de una categoría Woo / editor de página. Wordfence NO lo bloquea.
 */
export function buildFaqVisibleHtml(
  pairs: Array<{ question: string; answer?: string }>,
  opts?: { heading?: string }
): string {
  const list = (Array.isArray(pairs) ? pairs : [])
    .map((p) => ({
      question: String(p?.question || '').trim(),
      answer: String(p?.answer || '').trim(),
    }))
    .filter((p) => p.question.length >= 8);
  if (!list.length) return '';

  const heading = (opts?.heading || 'Preguntas frecuentes').trim();
  const parts: string[] = [`<h2>${escapeHtmlText(heading)}</h2>`];
  for (const p of list) {
    parts.push(`<h3>${escapeHtmlText(p.question)}</h3>`);
    if (p.answer.length >= 20) {
      parts.push(`<p>${escapeHtmlText(p.answer)}</p>`);
    } else {
      parts.push(
        '<p>Escribí acá tu respuesta en 2–4 oraciones, con tu experiencia o datos propios (no copies texto genérico de IA).</p>'
      );
    }
  }
  return parts.join('\n\n');
}

/** Misma FAQ en texto plano (editores que no aceptan HTML). */
export function buildFaqVisiblePlain(
  pairs: Array<{ question: string; answer?: string }>,
  opts?: { heading?: string }
): string {
  const list = (Array.isArray(pairs) ? pairs : [])
    .map((p) => ({
      question: String(p?.question || '').trim(),
      answer: String(p?.answer || '').trim(),
    }))
    .filter((p) => p.question.length >= 8);
  if (!list.length) return '';

  const heading = (opts?.heading || 'Preguntas frecuentes').trim();
  const lines: string[] = [heading, ''];
  for (const p of list) {
    lines.push(p.question);
    lines.push(
      p.answer.length >= 20
        ? p.answer
        : 'Escribí acá tu respuesta en 2–4 oraciones, con tu experiencia o datos propios.'
    );
    lines.push('');
  }
  return lines.join('\n').trim();
}

function wrapJsonLd(payload: unknown): string {
  return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Lee un <meta name|property="key" content="..."> (en cualquier orden de atributos). */
export function extractMeta(html: string, key: string): string {
  const k = escapeRegExp(key);
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${k}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeHtmlEntities(m[1].trim()) : '';
}

function siteOrigin(pageUrl: string): string {
  try {
    return new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`).origin;
  } catch {
    return '';
  }
}

/** Normaliza un precio en formato AR/US a número string ("12.345,67" → "12345.67"). */
function normalizePrice(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/[^\d.,]/g, '');
  if (s.includes('.') && s.includes(',')) {
    // "12.345,67" → punto miles, coma decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "12345,67" → coma decimal
    s = s.replace(',', '.');
  }
  // solo dejar el primer punto decimal
  const parts = s.split('.');
  if (parts.length > 2) s = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? String(n) : '';
}

export type ProductInfo = {
  name: string;
  image: string;
  description: string;
  price: string;
  currency: string;
  brand: string;
};

export function detectProductInfo(html: string, title: string, h1: string): ProductInfo {
  const name = (extractMeta(html, 'og:title') || h1 || title.split(/\s*[|–—]\s*/)[0] || '').trim();
  const image = extractMeta(html, 'og:image');
  const description = extractMeta(html, 'description') || extractMeta(html, 'og:description');
  let priceRaw = extractMeta(html, 'product:price:amount') || extractMeta(html, 'og:price:amount');
  const currency =
    extractMeta(html, 'product:price:currency') || extractMeta(html, 'og:price:currency') || 'ARS';
  if (!priceRaw) {
    const ip = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i);
    if (ip) priceRaw = ip[1];
  }
  const price = normalizePrice(priceRaw);
  const brand = extractMeta(html, 'product:brand') || extractMeta(html, 'og:brand');
  return { name, image, description, price, currency, brand };
}

export function buildProductJsonLd(
  info: ProductInfo,
  pageUrl: string,
  opts: { includeOffers?: boolean } = {}
): string {
  const includeOffers = opts.includeOffers !== false; // por defecto incluye si hay precio
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: info.name,
  };
  if (info.image) payload.image = info.image;
  if (info.description) payload.description = info.description.slice(0, 400);
  if (info.brand) payload.brand = { '@type': 'Brand', name: info.brand };
  if (includeOffers && info.price) {
    payload.offers = {
      '@type': 'Offer',
      price: info.price,
      priceCurrency: info.currency || 'ARS',
      availability: 'https://schema.org/InStock',
      url: pageUrl,
    };
  }
  return wrapJsonLd(payload);
}

export type ArticleInfo = {
  headline: string;
  image: string;
  datePublished: string;
  dateModified: string;
  author: string;
  publisher: string;
};

export function detectArticleInfo(html: string, title: string, h1: string): ArticleInfo {
  const headline = (h1 || extractMeta(html, 'og:title') || title.split(/\s*[|–—]\s*/)[0] || '').trim();
  const image = extractMeta(html, 'og:image');
  const datePublished = extractMeta(html, 'article:published_time');
  const dateModified = extractMeta(html, 'article:modified_time') || datePublished;
  const author = extractMeta(html, 'author');
  const publisher = extractMeta(html, 'og:site_name');
  return { headline, image, datePublished, dateModified, author, publisher };
}

export function buildArticleJsonLd(info: ArticleInfo, pageUrl: string): string {
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: info.headline,
    mainEntityOfPage: pageUrl,
  };
  if (info.image) payload.image = info.image;
  if (info.datePublished) payload.datePublished = info.datePublished;
  if (info.dateModified) payload.dateModified = info.dateModified;
  if (info.author) payload.author = { '@type': 'Person', name: info.author };
  if (info.publisher) payload.publisher = { '@type': 'Organization', name: info.publisher };
  return wrapJsonLd(payload);
}

export type OrgInfo = { name: string; url: string; logo: string };

export function detectOrgInfo(html: string, title: string, pageUrl: string): OrgInfo {
  const parts = title.split(/\s*[|–—]\s*/).map((s) => s.trim()).filter(Boolean);
  const name =
    extractMeta(html, 'og:site_name') ||
    (parts.length ? parts[parts.length - 1] : '') ||
    '';
  const url = siteOrigin(pageUrl);
  const logo = extractMeta(html, 'og:image');
  return { name, url, logo };
}

export function buildOrganizationJsonLd(info: OrgInfo): string {
  const payload: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: info.name,
  };
  if (info.url) payload.url = info.url;
  if (info.logo) payload.logo = info.logo;
  return wrapJsonLd(payload);
}

/**
 * Elige la mejor estructura para ofrecer según el tipo de página.
 * Prioridad: FAQ (mayor valor AEO) → Producto → Artículo → Organización.
 * Devuelve null si ya está todo cubierto.
 */
export function resolveStructuredOffer(
  html: string,
  pageUrl: string,
  pageType: ComprehensionPageType,
  title: string,
  h1: string,
  questions: FaqPair[],
  existing: ExistingStructuredData
): StructuredOffer | null {
  // 1. Producto → Product Schema (cierre técnico natural de una ficha)
  if (shouldAutoOfferProductSchema(pageType) && !existing.hasProduct) {
    const info = detectProductInfo(html, title, h1);
    if (info.name) {
      return {
        type: 'product',
        code: buildProductJsonLd(info, pageUrl),
        missionTitle: 'Hacer que Google entienda que esto es un producto',
        description:
          'Primero el contenido de la ficha (para qué sirve, para quién). Después este bloque técnico Product Schema — invisible para visitantes — ayuda a Google y a las IA a clasificarlo.',
        copyLabel: 'Copiar Schema Product',
        note: info.price
          ? 'No hace falta FAQPage Schema acá: en un producto el cierre técnico típico es Product.'
          : 'No detectamos precio para incluir automáticamente. El bloque igual ayuda; el precio conviene dejarlo al plugin de la tienda.',
      };
    }
  }

  // 2. FAQ Schema — solo en tipos donde la política lo permite (no categoría/producto/home/post)
  if (
    questions.length >= 1 &&
    !existing.hasFaqPage &&
    shouldAutoOfferFaqSchema(pageType)
  ) {
    return {
      type: 'faq',
      code: buildFaqJsonLd(questions),
      codeJson: buildFaqJsonLd(questions, { wrapScript: false }),
      contentHtml: buildFaqVisibleHtml(questions, { heading: 'Preguntas frecuentes' }),
      missionTitle: 'Hacer que las IA lean tus preguntas',
      description: `Esta página responde ${questions.length} ${
        questions.length === 1 ? 'pregunta' : 'preguntas'
      }. El contenido visible es lo primero; el Schema es el paso técnico opcional (JSON-LD vía plugin SEO / HTML seguro).`,
      copyLabel: 'Copiar Schema (JSON-LD)',
      note:
        questions.length === 1
          ? 'Con 1 pregunta las IA ya la entienden. Para el resultado enriquecido de Google, sumá otra pregunta con su respuesta.'
          : 'El Schema es invisible. No lo pegues en la descripción de una categoría (Wordfence lo bloquea).',
    };
  }

  // 3. Artículo/blog sin Article schema
  if (pageType === 'post' && !existing.hasArticle) {
    const info = detectArticleInfo(html, title, h1);
    if (info.headline) {
      return {
        type: 'article',
        code: buildArticleJsonLd(info, pageUrl),
        missionTitle: 'Hacer que Google entienda que esto es un artículo',
        description:
          'Generamos la ficha de artículo (título, autor y fecha si están) para que Google y las IA sepan de qué trata y cuándo se publicó. En entradas, el AEO principal sigue siendo el contenido útil — no FAQPage automático.',
        copyLabel: 'Copiar código del artículo',
      };
    }
  }

  // 4. Organización (home / categoría / página sin identidad clara)
  if (!existing.hasOrganization && !existing.hasLocalBusiness) {
    const info = detectOrgInfo(html, title, pageUrl);
    if (info.name && (pageType === 'home' || pageType === 'category' || pageType === 'page' || pageType === 'unknown')) {
      return {
        type: 'organization',
        code: buildOrganizationJsonLd(info),
        missionTitle: 'Decirle a Google qué empresa está detrás',
        description:
          pageType === 'category'
            ? 'En una categoría el trabajo AEO principal es el contenido útil (preguntas que ayuda a responder). Este Schema de organización es opcional y habla de la marca, no reemplaza el texto de la categoría.'
            : 'Generamos la identidad de tu empresa (nombre, sitio y logo) para que Google y las IA sepan quién es responsable de esta página.',
        copyLabel: 'Copiar código de la empresa',
      };
    }
  }

  return null;
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
  const canOfferFaqStructure =
    questions.length >= 1 && !faqStructureAlreadyPresent && shouldAutoOfferFaqSchema(pageType);


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
          : 'No detectamos preguntas claras. Poné cada una como H2/H3 o en negrita con “¿…?”, y la respuesta en el párrafo de abajo.',
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
    offer: resolveStructuredOffer(
      html,
      pageUrl,
      pageType,
      title,
      h1,
      questions,
      existingStructured
    ),
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
