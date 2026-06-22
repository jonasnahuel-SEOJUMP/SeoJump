// ═══════════════════════════════════════════════════════════════════════════
// LINK AUDIT — Clasificación de URLs y crawl del Detective de Enlaces
// Módulo puro (sin "use server"): lo importan las server actions de actions.ts.
// Reglas de negocio: ver architecture.md sección 5.
// ═══════════════════════════════════════════════════════════════════════════

import {
  fetchPage,
  extractLinksFromHtml,
  extractTitleFromHtml,
  checkLinkStatus,
} from './scraping'

/** Returns true if the URL is the root / home page of the domain. */
export function isHomePage(pageUrl: string, siteUrl: string): boolean {
  try {
    const page = new URL(pageUrl);
    const site = new URL(siteUrl);
    // Same host and pathname is '/', '' or equals the site pathname root
    return page.hostname === site.hostname &&
      (page.pathname === '/' || page.pathname === '' || page.pathname === site.pathname);
  } catch {
    // Fallback: string comparison
    const norm = (u: string) => u.replace(/\/$/, '').toLowerCase();
    return norm(pageUrl) === norm(siteUrl);
  }
}

/** Rutas de catálogo/hub: mal origen para inyectar anclas contextuales (rompe UX ecommerce). */
const CATALOG_HUB_PATH_PATTERNS = [
  /\/tienda(?:\/|$)/i,
  /\/productos?(?:\/|$)/i,
  /\/categor[ií]as?(?:\/|$)/i,
  /\/catalogo(?:\/|$)/i,
  /\/cat[aá]logo(?:\/|$)/i,
  /\/shop(?:\/|$)/i,
  /\/store(?:\/|$)/i,
  /\/colecci[oó]n(?:es)?(?:\/|$)/i,
  /\/collection(?:s)?(?:\/|$)/i,
];

/** Rutas de contenido informativo: buen origen para traspaso de fuerza con texto natural. */
const CONTENT_PATH_PATTERNS = [
  /\/blog(?:\/|$)/i,
  /\/articulos?(?:\/|$)/i,
  /\/posts?(?:\/|$)/i,
  /\/gu[ií]as?(?:\/|$)/i,
  /\/noticias?(?:\/|$)/i,
  /\/news(?:\/|$)/i,
  /\/magazine(?:\/|$)/i,
  /\/consejos(?:\/|$)/i,
  /\/recursos(?:\/|$)/i,
  /\/aprende(?:\/|$)/i,
];

export function isCatalogHubPage(pageUrl: string, siteUrl: string): boolean {
  if (isHomePage(pageUrl, siteUrl)) return true;
  try {
    const path = new URL(pageUrl).pathname;
    return CATALOG_HUB_PATH_PATTERNS.some((p) => p.test(path));
  } catch {
    return false;
  }
}

export function isContentPage(pageUrl: string): boolean {
  try {
    const path = new URL(pageUrl).pathname;
    return CONTENT_PATH_PATTERNS.some((p) => p.test(path));
  } catch {
    return false;
  }
}

/** Página válida como ORIGEN de un enlace contextual (no hub/catálogo). */
export function isValidLinkSourcePage(pageUrl: string, siteUrl: string): boolean {
  return !!pageUrl && !isCatalogHubPage(pageUrl, siteUrl);
}

export function filterInternalLinkingRecs(
  items: Array<{ fromPage?: string; toPage?: string; suggestedAnchor?: string; reason?: string }>,
  siteUrl: string
) {
  return (items || [])
    .filter(
      (item) =>
        item.fromPage &&
        item.toPage &&
        isValidLinkSourcePage(item.fromPage, siteUrl)
    )
  // Priorizar orígenes de blog/contenido sobre otras páginas válidas (ej. landing genérica).
    .sort((a, b) => {
      const aContent = isContentPage(a.fromPage!) ? 1 : 0;
      const bContent = isContentPage(b.fromPage!) ? 1 : 0;
      return bContent - aContent;
    });
}

export function filterAnchorTextRecs(
  items: Array<{ page?: string; currentAnchor?: string; linkTo?: string; suggestedAnchor?: string; reason?: string }>,
  siteUrl: string
) {
  return (items || [])
    .filter((item) => item.page && isValidLinkSourcePage(item.page, siteUrl))
    .sort((a, b) => {
      const aContent = isContentPage(a.page!) ? 1 : 0;
      const bContent = isContentPage(b.page!) ? 1 : 0;
      return bContent - aContent;
    });
}

const GENERIC_ANCHOR_PATTERNS = [
  /^click\s?aqu[ií]$/i, /^hac[eé]\s?clic$/i, /^clic\s?aqu[ií]$/i,
  /^ver\s?m[aá]s$/i, /^leer\s?m[aá]s$/i, /^ac[aá]$/i, /^aqu[ií]$/i,
  /^click\s?here$/i, /^read\s?more$/i, /^learn\s?more$/i,
  /^more$/i, /^m[aá]s$/i, /^ir$/i, /^link$/i, /^enlace$/i,
];

export function isGenericAnchor(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 3) return true;
  if (clean === "") return true;
  return GENERIC_ANCHOR_PATTERNS.some(p => p.test(clean));
}

export async function crawlSiteLinks(siteUrl: string) {
  const cleanUrl = siteUrl.replace(/\/$/, '');
  const visited = new Set<string>();
  const pages: Array<{ url: string; title: string; links: Array<{ href: string; anchorText: string; isInternal: boolean; statusCode: number }> }> = [];
  const queue: Array<{ url: string; depth: number }> = [{ url: cleanUrl, depth: 0 }];
  const allDestinations = new Map<string, number>(); // url -> status code (lazy check)
  const MAX_PAGES = 5;
  const MAX_DEPTH = 1;
  // Hard wall: abort the whole crawl if it takes more than 25 seconds
  const crawlDeadline = Date.now() + 25000;

  // BFS crawl
  while (queue.length > 0 && pages.length < MAX_PAGES && Date.now() < crawlDeadline) {
    const { url, depth } = queue.shift()!;
    const normalizedUrl = url.replace(/\/$/, '');
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    const result = await fetchPage(url);
    if (!result.ok) continue;

    const links = extractLinksFromHtml(result.html, url);
    const title = extractTitleFromHtml(result.html);

    pages.push({
      url: normalizedUrl,
      title,
      links: links.map(l => ({ ...l, statusCode: -1 })), // status checked later
    });

    // Enqueue internal links for next level
    if (depth < MAX_DEPTH) {
      for (const link of links) {
        if (link.isInternal) {
          const normalized = link.href.replace(/\/$/, '');
          if (!visited.has(normalized) && !queue.some(q => q.url.replace(/\/$/, '') === normalized)) {
            queue.push({ url: link.href, depth: depth + 1 });
          }
        }
      }
    }

    // Collect all destinations for status check
    for (const link of links) {
      if (!allDestinations.has(link.href)) {
        allDestinations.set(link.href, -1);
      }
    }
  }

  // Check status codes for all unique destinations (parallel, batched)
  // Cap at 15 URLs to avoid exhausting the function timeout
  const MAX_LINK_CHECKS = 15;
  const destinationUrls = Array.from(allDestinations.keys()).slice(0, MAX_LINK_CHECKS);
  const BATCH_SIZE = 5;
  for (let i = 0; i < destinationUrls.length && Date.now() < crawlDeadline; i += BATCH_SIZE) {
    const batch = destinationUrls.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(url => checkLinkStatus(url)));
    batch.forEach((url, idx) => {
      allDestinations.set(url, results[idx]);
    });
  }

  // Update page links with status codes
  for (const page of pages) {
    for (const link of page.links) {
      link.statusCode = allDestinations.get(link.href) ?? 0;
    }
  }

  // Collect all internal URLs found anywhere
  const allInternalUrls = new Set<string>();
  for (const page of pages) {
    allInternalUrls.add(page.url);
    for (const link of page.links) {
      if (link.isInternal) {
        allInternalUrls.add(link.href.replace(/\/$/, ''));
      }
    }
  }

  // Find broken links
  const brokenLinks: Array<{ page: string; href: string; anchorText: string; statusCode: number }> = [];
  for (const page of pages) {
    for (const link of page.links) {
      if (link.statusCode >= 400 || link.statusCode === 0) {
        brokenLinks.push({
          page: page.url,
          href: link.href,
          anchorText: link.anchorText,
          statusCode: link.statusCode,
        });
      }
    }
  }

  // Find generic anchors (internal links only)
  const genericAnchors: Array<{ page: string; href: string; anchorText: string }> = [];
  for (const page of pages) {
    for (const link of page.links) {
      if (link.isInternal && isGenericAnchor(link.anchorText)) {
        genericAnchors.push({
          page: page.url,
          href: link.href,
          anchorText: link.anchorText,
        });
      }
    }
  }

  // Find orphan pages (internal pages with 0 incoming links from crawled pages)
  const incomingCount = new Map<string, number>();
  for (const url of allInternalUrls) {
    incomingCount.set(url, 0);
  }
  for (const page of pages) {
    for (const link of page.links) {
      if (link.isInternal) {
        const normalized = link.href.replace(/\/$/, '');
        incomingCount.set(normalized, (incomingCount.get(normalized) || 0) + 1);
      }
    }
  }
  // The home page always has incoming (it's the entry point)
  incomingCount.set(cleanUrl, 999);
  const orphanPages = Array.from(incomingCount.entries())
    .filter(([_, count]) => count === 0)
    .map(([url]) => url);

  return {
    pages,
    allInternalUrls: Array.from(allInternalUrls),
    brokenLinks,
    genericAnchors,
    orphanPages,
  };
}
