// ═══════════════════════════════════════════════════════════════════════════
// SCRAPING — Primitivas de fetch y parseo de HTML
// Módulo puro (sin "use server"): lo importan las server actions de actions.ts
// y el módulo linkAudit.ts. No depende de sesión ni de créditos IA.
// ═══════════════════════════════════════════════════════════════════════════

import { decodeHtmlEntities } from './textUtils'
import type { CompetitorSnapshot } from './supabase'

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

export async function fetchPage(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  try {
    const finalUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(5000),
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
  'ultimos ingresos', 'nuevos ingresos', 'recien llegados', 'novedades',
  'destacados', 'productos destacados', 'mas vendidos', 'los mas vendidos',
  'mas buscados', 'ofertas', 'promociones', 'liquidacion', 'outlet',
  'productos relacionados', 'tambien te puede interesar', 'quizas te interese',
  'productos similares', 'completa tu compra', 'vistos recientemente',
  'categorias', 'nuestras categorias', 'marcas', 'nuestras marcas',
  'carrito', 'tu carrito', 'lista de deseos', 'favoritos',
  'mi cuenta', 'seguinos', 'redes sociales', 'newsletter', 'suscribite',
  'medios de pago', 'formas de pago', 'envios', 'menu', 'filtrar', 'filtros',
  'ordenar por', 'resultados', 'coleccion', 'colecciones', 'catalogo',
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
  return AEO_UI_HEADING_PATTERNS.some(
    (p) => norm === p || norm.startsWith(p + ' ') || norm.endsWith(' ' + p)
  );
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

/** Scrapea un sitio y arma el snapshot (título, H1, headings) reusando los scrapers existentes. */
export async function buildCompetitorSnapshot(url: string): Promise<CompetitorSnapshot> {
  const [meta, sections] = await Promise.all([
    scrapeMetadata(url),
    scrapeHeadingSections(url),
  ]);
  return {
    title: meta.title || '',
    h1: meta.h1 || '',
    headings: sections.map((s) => s.heading).slice(0, 8),
    scrapedAt: new Date().toISOString(),
  };
}
