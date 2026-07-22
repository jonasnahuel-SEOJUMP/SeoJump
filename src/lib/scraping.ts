// ═══════════════════════════════════════════════════════════════════════════
// SCRAPING — Primitivas de fetch y parseo de HTML
// Módulo puro (sin "use server"): lo importan las server actions de actions.ts
// y el módulo linkAudit.ts. No depende de sesión ni de créditos IA.
// ═══════════════════════════════════════════════════════════════════════════

import { decodeHtmlEntities } from './textUtils'

/**
 * Detecta el tipo real de página desde el HTML (huellas de WooCommerce/WordPress
 * en la clase del <body>). Es mucho más confiable que adivinar por la URL, porque
 * muchas tiendas usan enlaces "limpios" (ej: /pulidoras/ en vez de
 * /categoria-producto/pulidoras/) donde la URL no revela el tipo.
 * Devuelve: 'home' | 'category' | 'product' | 'post' | 'page' | '' (desconocido).
 */
export function detectPageTypeFromHtml(html: string): string {
  if (!html) return '';
  const bodyMatch = html.match(/<body[^>]*class=["']([^"']+)["']/i);
  const bodyClass = (bodyMatch ? bodyMatch[1] : '').toLowerCase();

  if (bodyClass) {
    // Categoría de tienda (archivo de taxonomía de productos)
    if (/\b(tax-product_cat|term-|post-type-archive-product|woocommerce-shop|archive)\b/.test(bodyClass) &&
        !/\bsingle-product\b/.test(bodyClass)) {
      // "archive" solo cuenta como categoría si además hay marcas de WooCommerce
      if (/\b(tax-product_cat|post-type-archive-product|woocommerce-shop|woocommerce-page)\b/.test(bodyClass) ||
          /\bterm-/.test(bodyClass)) {
        return 'category';
      }
    }
    // Ficha de producto
    if (/\bsingle-product\b/.test(bodyClass)) return 'product';
    // Entrada de blog
    if (/\b(single-post|single\s|blog|category|tag-)\b/.test(bodyClass) && !/\bwoocommerce/.test(bodyClass)) {
      if (/\bsingle-post\b/.test(bodyClass) || /\bblog\b/.test(bodyClass)) return 'post';
    }
    // Inicio
    if (/\b(home|front-page)\b/.test(bodyClass)) return 'home';
    // Página estática común
    if (/\b(page-template|page-id-|page\b)\b/.test(bodyClass)) return 'page';
  }

  return '';
}

/**
 * Escanea metadatos Title, Description y H1 de forma rápida con timeout de 4 segundos.
 */
export async function scrapeMetadata(siteUrl: string): Promise<{ title: string; description: string; h1: string; pageType?: string }> {
  const result: { title: string; description: string; h1: string; pageType?: string } = { title: "", description: "", h1: "", pageType: "" };
  if (!siteUrl) return result;

  let targetUrl = siteUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }
  const fetchUrl = targetUrl.includes('?')
    ? `${targetUrl}&nocache=${Date.now()}`
    : `${targetUrl}?nocache=${Date.now()}`;

  try {
    const res = await fetch(fetchUrl, {
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return result;
    }

    const html = await res.text();

    // Extract Title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      result.title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim());
    }

    // Extract Meta Description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    if (descMatch) {
      result.description = decodeHtmlEntities(descMatch[1].trim());
    }

    // Extract H1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      result.h1 = decodeHtmlEntities(h1Match[1].replace(/<[^>]+>/g, '').trim());
    }

    // Detectar tipo de página desde el HTML (huellas de WooCommerce/WordPress)
    result.pageType = detectPageTypeFromHtml(html);
  } catch (error) {
    console.error("Error scraping metadata:", error);
  }

  return result;
}

/** Clases habituales en enlaces/botones de grillas WooCommerce y temas como Flatsome. */
const CATALOG_UI_LINK_CLASS_PATTERNS = [
  /woocommerce-loop-product/i,
  /add_to_cart/i,
  /product_type_/i,
  /product-small/i,
  /show-on-hover/i,
  /box-text-products/i,
  /product-box/i,
  /product-grid/i,
  /products\s/i,
];

export function isCatalogUiLinkFromTag(aTagAttributes: string): boolean {
  const cls = (aTagAttributes.match(/class=["']([^"']+)["']/i)?.[1] || '').toLowerCase();
  if (!cls) return false;
  return CATALOG_UI_LINK_CLASS_PATTERNS.some((p) => p.test(cls));
}

export function extractLinksFromHtml(
  html: string,
  baseUrl: string
): Array<{ href: string; anchorText: string; isInternal: boolean; isCatalogUiLink: boolean }> {
  const links: Array<{ href: string; anchorText: string; isInternal: boolean; isCatalogUiLink: boolean }> = [];
  const regex = /<a([^>]*?)href=["']([^"'#]+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');

  while ((match = regex.exec(html)) !== null) {
    try {
      const rawHref = match[2].trim();
      if (rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) continue;

      const resolved = new URL(rawHref, baseUrl).href;
      const anchorText = match[4].replace(/<[^>]+>/g, '').trim();
      const linkHost = new URL(resolved).hostname.replace(/^www\./, '');
      const isInternal = linkHost === baseHost;
      const tagAttrs = `${match[1] || ''} ${match[3] || ''}`;

      links.push({
        href: resolved,
        anchorText,
        isInternal,
        isCatalogUiLink: isCatalogUiLinkFromTag(tagAttrs),
      });
    } catch (e) {
      // skip malformed URLs
    }
  }
  return links;
}

export function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : "";
}

export async function fetchPage(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<{ html: string; ok: boolean; status: number }> {
  const timeoutMs = opts.timeoutMs ?? 5000;
  try {
    const finalUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return { html: '', ok: false, status: response.status };
    const html = await response.text();
    return { html, ok: true, status: response.status };
  } catch (e) {
    return { html: '', ok: false, status: 0 };
  }
}

export async function checkLinkStatus(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)' },
      signal: AbortSignal.timeout(2500),
      redirect: 'follow',
    });
    return response.status;
  } catch (e) {
    return 0;
  }
}

// ─── AEO: extracción de secciones (encabezado + párrafo) ─────────────────────

export type HeadingSection = {
  heading: string;
  headingTag: 'H2' | 'H3';
  paragraphText: string;
  charCount: number;
};

/**
 * Encabezados típicos de navegación / UI de e-commerce que NO son contenido
 * informativo y por lo tanto no sirven para AEO (carruseles, secciones de tienda).
 * Se comparan en minúsculas y sin tildes.
 */
const AEO_UI_HEADING_PATTERNS = [
  'ultimos ingresos', 'nuevos ingresos', 'ultimos productos', 'nuevos productos',
  'recien llegados', 'recien ingresados', 'novedades', 'lo nuevo', 'lo ultimo',
  'destacados', 'productos destacados', 'mas vendidos', 'los mas vendidos',
  'mas buscados', 'lo mas buscado', 'top ventas', 'best sellers', 'mas populares',
  'ofertas', 'ofertas destacadas', 'promociones', 'promos', 'liquidacion', 'outlet',
  'productos relacionados', 'tambien te puede interesar', 'quizas te interese',
  'productos similares', 'completa tu compra', 'vistos recientemente',
  'productos vistos', 'seguir comprando', 'agregados recientemente',
  'categorias', 'nuestras categorias', 'marcas', 'nuestras marcas',
  'carrito', 'tu carrito', 'lista de deseos', 'favoritos',
  'mi cuenta', 'seguinos', 'redes sociales', 'newsletter', 'suscribite',
  'medios de pago', 'formas de pago', 'envios', 'menu', 'filtrar', 'filtros',
  'ordenar por', 'resultados', 'coleccion', 'colecciones', 'catalogo', 'tienda',
];

/** Palabras que indican que el encabezado SÍ es una pregunta / contenido informativo. */
const AEO_INFORMATIVE_HINTS = [
  'que es', 'que son', 'como', 'cuando', 'cuanto', 'cuanta', 'cuantos',
  'por que', 'para que', 'donde', 'cual', 'quien', 'guia', 'beneficios',
  'ventajas', 'diferencia', 'tipos de', 'pasos', 'consejos',
];

/** Frases que indican que el "párrafo" es ruido de interfaz, no contenido real. */
const AEO_UI_TEXT_PATTERNS = [
  'añadir a la lista de deseos', 'agregar al carrito', 'añadir al carrito',
  'vista rapida', 'vista rápida', 'comprar ahora', 'ver mas', 'ver más',
  'agotado', 'sin stock', 'leer mas', 'leer más', 'seleccionar opciones',
];

export function normalizeForAeo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/\s+/g, ' ')
    .trim();
}

/** True si el encabezado es una sección de navegación/UI, no contenido informativo. */
export function isUiNavigationHeading(heading: string): boolean {
  const norm = normalizeForAeo(heading);
  if (!norm) return true;

  // Si el encabezado es claramente una pregunta o guía informativa, NO es UI.
  const isQuestion = heading.includes('?') || heading.includes('¿');
  const looksInformative = AEO_INFORMATIVE_HINTS.some(
    (h) => norm === h || norm.startsWith(h + ' ') || norm.includes(' ' + h + ' ')
  );
  if (isQuestion || looksInformative) return false;

  // Coincidencia por palabra completa: atrapa «Últimos ingresos», «Nuestras
  // Marcas», «Productos destacados de la semana», etc., sin cortar palabras.
  // Los patrones solo contienen letras/espacios, así que no requieren escape.
  const words = ` ${norm} `;
  return AEO_UI_HEADING_PATTERNS.some((p) => norm === p || words.includes(` ${p} `));
}

/** True si el texto parece un listado de productos / botones de interfaz. */
export function isUiNoiseText(text: string): boolean {
  const norm = normalizeForAeo(text);
  return AEO_UI_TEXT_PATTERNS.some((p) => norm.includes(normalizeForAeo(p)));
}

/**
 * Fetch a page's HTML and extract H2/H3 headings with their following paragraph text.
 * Used by getAeoOpportunities to gather real content for Gemini analysis.
 */
export async function scrapeHeadingSections(pageUrl: string): Promise<HeadingSection[]> {
  if (!pageUrl) return [];

  let targetUrl = pageUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const res = await fetch(targetUrl, {
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    let html = await res.text();

    // Strip script and style tags (same pattern as verifyContentMission)
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    // Find all H2 and H3 tags
    const headingRegex = /<h([23])[^>]*>([\s\S]*?)<\/h[23]>/gi;
    const sections: HeadingSection[] = [];
    let match;

    while ((match = headingRegex.exec(html)) !== null) {
      const headingTag = match[1] === '2' ? 'H2' : 'H3' as const;
      const headingText = match[2].replace(/<[^>]+>/g, '').trim();

      if (!headingText) continue;

      // Filter: skip navigation/UI section headings (carruseles, tienda, menús).
      // No son contenido informativo y generan falsos positivos en AEO.
      if (isUiNavigationHeading(headingText)) continue;

      // Find the next <p> tag after this heading in the HTML
      const afterHeading = html.substring(match.index + match[0].length);
      const pMatch = afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      let paragraphText = '';
      if (pMatch) {
        paragraphText = pMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Filter: skip sections where paragraph is empty or less than 20 chars
      if (!paragraphText || paragraphText.length < 20) continue;

      // Filter: skip when the text is interface noise (botones de producto, etc.).
      if (isUiNoiseText(paragraphText)) continue;

      sections.push({
        heading: headingText,
        headingTag,
        paragraphText,
        charCount: paragraphText.length,
      });
    }

    // Sort by paragraph length (longest first - more content to optimize)
    sections.sort((a, b) => b.charCount - a.charCount);

    // Return max 5 sections
    return sections.slice(0, 5);
  } catch (error) {
    console.error("[scrapeHeadingSections] Error:", error);
    return [];
  }
}

// Detección 100% determinística (sin IA): mide rastros de experiencia real,
// evidencia propia, opinión, casos reales y datos concretos. La usa el módulo
// humanScore.ts para calcular el puntaje. NO decide "esto es IA": mide si el
// contenido aporta algo que una IA promedio no puede inventar.
// ═══════════════════════════════════════════════════════════════════════════

export type HumanSignals = {
  wordCount: number;
  experienceHits: number;   // primera persona / vivencia ("probamos", "aprendimos")
  opinionHits: number;      // postura ("recomendamos", "preferimos")
  limitationHits: number;   // límites/desventajas ("no sirve si", "la desventaja")
  caseResultHits: number;   // resultados/casos ("pasó de X a Y", "logramos")
  testimonialHits: number;  // voz del cliente ("nos dijo", "reseña")
  fluffHits: number;        // relleno genérico ("es importante", "en resumen")
  numberHits: number;       // números sueltos
  percentHits: number;      // porcentajes
  priceHits: number;        // precios ($, pesos, usd)
  yearHits: number;         // años (2019, 2024...)
  durationHits: number;     // duración ("hace 3 años", "5 años de")
  imageCount: number;       // <img> total (no data-uri)
  ownImageCount: number;    // imágenes del propio dominio (evidencia propia)
  videoCount: number;       // <video> o embeds youtube/vimeo
  tableCount: number;       // <table>
  faqPresent: boolean;      // FAQ schema o varios encabezados-pregunta
};

const HS_EXPERIENCE = [
  'nosotros', 'probamos', 'usamos', 'utilizamos', 'en nuestro caso', 'cuando empezamos',
  'con el tiempo', 'aprendimos', 'descubrimos', 'notamos', 'nos dimos cuenta', 'trabajamos',
  'nuestro equipo', 'en mi experiencia', 'en nuestra experiencia', 'anos de experiencia',
  'nos paso', 'fabricamos', 'desarrollamos', 'cometimos', 'nos equivocamos', 'venimos haciendo',
  'atendimos', 'instalamos', 'aplicamos', 'testeamos', 'comprobamos', 'nuestra experiencia',
  'llevamos', 'nos especializamos', 'empezamos en', 'al principio', 'el error que',
];

const HS_OPINION = [
  'recomendamos', 'recomiendo', 'preferimos', 'prefiero', 'en mi opinion', 'creemos que',
  'lo mejor es', 'conviene', 'vale la pena', 'desde nuestro punto de vista', 'sinceramente',
  'honestamente', 'a nuestro criterio', 'elegiria', 'te conviene', 'nuestro consejo',
  'a mi me gusta', 'nos gusta mas',
];

const HS_LIMITATION = [
  'no sirve para', 'no recomendamos', 'no es ideal', 'no es la mejor opcion', 'la desventaja',
  'las desventajas', 'el problema es', 'el inconveniente', 'no funciona bien', 'limitacion',
  'contraindic', 'no lo uses si', 'evitalo si', 'punto en contra', 'contras', 'no conviene',
  'tene en cuenta que', 'no es para todos',
];

const HS_CASE = [
  'paso de', 'pasamos de', 'pasaron de', 'aumento un', 'aumentaron', 'crecio un', 'logramos',
  'conseguimos', 'el resultado fue', 'los resultados', 'duplicamos', 'triplicamos', 'redujimos',
  'caso real', 'caso de exito', 'uno de nuestros clientes', 'un cliente', 'una clienta',
];

const HS_TESTIMONIAL = [
  'nos dijo', 'nos escribio', 'opinion de', 'resena', 'testimonio', 'valoracion', 'valoraciones',
  'nos comento', 'nos conto', 'segun nuestros clientes', 'nuestros clientes nos',
];

const HS_FLUFF = [
  'es importante', 'en la actualidad', 'hoy en dia', 'en conclusion', 'en resumen',
  'sin lugar a dudas', 'cabe destacar', 'cabe mencionar', 'en el mundo de', 'juega un papel',
  'no es un secreto', 'en este articulo', 'en este post', 'como todos sabemos', 'a la hora de',
  'en el mercado actual', 'dia a dia', 'se ha convertido en', 'no cabe duda', 'es fundamental',
  'es esencial', 'marca la diferencia', 'en pocas palabras', 'vale la pena mencionar',
  'de gran importancia', 'amplia gama', 'amplia variedad', 'soluciones a medida',
  'calidad y servicio', 'amplia experiencia', 'lider en el mercado', 'los mejores',
];

/** Cuenta cuántos patrones de la lista aparecen (al menos una vez) en el texto normalizado. */
function countPatternHits(normText: string, patterns: string[]): number {
  let hits = 0;
  for (const p of patterns) {
    if (normText.includes(p)) hits += 1;
  }
  return hits;
}

/**
 * Extrae señales de valor humano de un HTML ya descargado. No hace fetch.
 * @param html  HTML crudo de la página
 * @param pageUrl  URL de la página (para detectar imágenes del propio dominio)
 */
export function extractHumanSignals(html: string, pageUrl: string): HumanSignals {
  const empty: HumanSignals = {
    wordCount: 0, experienceHits: 0, opinionHits: 0, limitationHits: 0, caseResultHits: 0,
    testimonialHits: 0, fluffHits: 0, numberHits: 0, percentHits: 0, priceHits: 0,
    yearHits: 0, durationHits: 0, imageCount: 0, ownImageCount: 0, videoCount: 0,
    tableCount: 0, faqPresent: false,
  };
  if (!html) return empty;

  // ── Detección a nivel HTML (imágenes, video, tablas) antes de limpiar tags ──
  let host = '';
  try {
    host = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`).hostname.replace(/^www\./, '');
  } catch { /* host queda vacío */ }

  let imageCount = 0;
  let ownImageCount = 0;
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const src = imgMatch[1].trim();
    if (src.startsWith('data:')) continue; // píxeles/íconos embebidos
    imageCount += 1;
    // Relativa = propia; absoluta = propia solo si el host coincide
    const isRelative = src.startsWith('/') || (!src.startsWith('http') && !src.startsWith('//'));
    if (isRelative) {
      ownImageCount += 1;
    } else if (host) {
      try {
        const imgHost = new URL(src.startsWith('//') ? `https:${src}` : src).hostname.replace(/^www\./, '');
        if (imgHost === host) ownImageCount += 1;
      } catch { /* ignore */ }
    }
  }

  const videoCount =
    (html.match(/<video[\s>]/gi) || []).length +
    (html.match(/(?:youtube\.com\/embed|youtu\.be\/|player\.vimeo\.com)/gi) || []).length;
  const tableCount = (html.match(/<table[\s>]/gi) || []).length;

  const faqPresent =
    /"@type"\s*:\s*"FAQPage"/i.test(html) ||
    (html.match(/<h[23][^>]*>[^<]*\?/gi) || []).length >= 2;

  // ── Texto plano para análisis de frases ────────────────────────────────────
  const bodyText = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = bodyText ? bodyText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  const normText = bodyText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  const percentHits = (normText.match(/\d+\s?%|\d+\s?por ciento/g) || []).length;
  const priceHits = (normText.match(/\$\s?\d+|\d+\s?(pesos|usd|dolares|euros|ars)/g) || []).length;
  const yearHits = (normText.match(/\b(19|20)\d{2}\b/g) || []).length;
  const durationHits = (normText.match(/hace\s+\d+\s+(anos?|meses|dias|semanas)|\d+\s+anos?\s+de|desde\s+(hace\s+)?\d+/g) || []).length;
  const numberHits = Math.min((normText.match(/\b\d+([.,]\d+)?\b/g) || []).length, 60);

  return {
    wordCount,
    experienceHits: countPatternHits(normText, HS_EXPERIENCE),
    opinionHits: countPatternHits(normText, HS_OPINION),
    limitationHits: countPatternHits(normText, HS_LIMITATION),
    caseResultHits: countPatternHits(normText, HS_CASE),
    testimonialHits: countPatternHits(normText, HS_TESTIMONIAL),
    fluffHits: countPatternHits(normText, HS_FLUFF),
    numberHits,
    percentHits,
    priceHits,
    yearHits,
    durationHits,
    imageCount,
    ownImageCount,
    videoCount,
    tableCount,
    faqPresent,
  };
}
