/**
 * Helpers de extracción y normalización de contenido de páginas.
 * Módulo puro extraído de actions.ts (parsing de HTML, normalización de texto
 * para comparaciones tolerantes, e inferencia de nicho desde la URL).
 */

import { decodeHtmlEntities } from './textUtils';

/** Extrae H1/H2/title, meta description/keywords o textos ALT del HTML crudo. */
export function extractFromHtml(html: string, type: string): string | string[] | null {
  try {
    if (type === 'H1') {
      const headings: string[] = [];
      const pushDecoded = (raw: string) => {
        const text = decodeHtmlEntities(raw.replace(/<[^>]+>/g, '').trim());
        if (text) headings.push(text);
      };

      // Título SEO (<title>) — lo que Google muestra en resultados de búsqueda
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) pushDecoded(titleMatch[1]);

      // Extract H1s
      const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
      let match;
      while ((match = h1Regex.exec(html)) !== null) {
        pushDecoded(match[1]);
      }

      // Extract H2s (as requested for thoroughness)
      const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
      while ((match = h2Regex.exec(html)) !== null) {
        pushDecoded(match[1]);
      }

      return headings.length > 0 ? headings : null;
    }

    if (type === 'META') {
      const metaValues: string[] = [];
      const pushDecoded = (raw: string) => {
        const text = decodeHtmlEntities(raw.trim());
        if (text) metaValues.push(text);
      };

      // Meta description
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
      if (descMatch) pushDecoded(descMatch[1]);

      // Meta keywords
      const keywMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']keywords["']/i);
      if (keywMatch) pushDecoded(keywMatch[1]);

      // Page title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) pushDecoded(titleMatch[1].replace(/<[^>]+>/g, ''));

      return metaValues.length > 0 ? metaValues : null;
    }

    if (type === 'ALT') {
      const alts: string[] = [];
      const regex = /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const text = decodeHtmlEntities(match[1].trim());
        if (text) alts.push(text);
      }
      return alts.length > 0 ? alts : null;
    }
  } catch (e) {
    console.error('Error extracting from HTML:', e);
  }
  return null;
}

/**
 * Parche de Puntuación Flexible: Normaliza el texto para evitar rebotes injustos.
 * Decodifica HTML, minúsculas, remueve acentos, y limpia signos ortográficos (puntos, comas, etc)
 */
export function normalize(text: string): string {
  if (!text) return '';

  // Decode HTML entities
  let clean = decodeHtmlEntities(text);

  // Fix broken UTF-8 patterns
  clean = clean
    .replace(/Ã±/g, "ñ")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã/g, "ñ")
    .replace(/\uFFFD/g, "ñ");

  // Specific typo fix: "paos" -> "paños"
  clean = clean.replace(/\bpaos\b/gi, "paños");

  // Lowercase + remove accents + remove punctuation + collapse whitespace
  return clean
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    // Remover puntos finales, comas, dos puntos y signos ortográficos
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¡!¿?:;"'|\[\]\u2013\u2014\u2026]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Infiere el rubro/nicho del negocio a partir del dominio (para prompts de IA). */
export function inferNichoFromUrl(siteUrl: string): string {
  if (!siteUrl) return '';
  try {
    const raw = siteUrl.trim().toLowerCase();
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const domainSlug = hostname.split('.')[0];

    const NICHO_MAP = [
      { match: /detail|car\s?wash|pulido|encerado|nano|wax|ceramic|coating|ppf/i, nicho: 'detailing vehicular' },
      { match: /zapato|calzado|zapatilla|shoe|boot/i, nicho: 'calzado' },
      { match: /ropa|indumentaria|moda|fashion|cloth/i, nicho: 'indumentaria' },
      { match: /gastro|restaurant|comida|food|menu|bistro|pizza|burger|sushi/i, nicho: 'gastronomía' },
      { match: /gym|fitness|muscula|entrena|sport|deporte/i, nicho: 'gimnasio' },
      { match: /ferret|herram|tool|pintur|bazar|ferreteria/i, nicho: 'ferretería y herramientas' },
      { match: /farm|salud|clinica|medic|dental|optica/i, nicho: 'salud' },
      { match: /inmob|prop|alquil|venta casa|real.?estat/i, nicho: 'inmobiliaria' },
      { match: /pet|mascotas|veterinar|perr|gat/i, nicho: 'veterinaria y mascotas' },
      { match: /electr|tecno|celular|phone|compu|laptop/i, nicho: 'electrónica y tecnología' },
      { match: /muebl|deco|hogar|home|sofa|silla|cama/i, nicho: 'muebles y decoración' },
      { match: /joyeria|bijou|pulsera|collar|anillo|jewelry/i, nicho: 'joyería y accesorios' },
      { match: /jardin|plant|flores|vivero|garden/i, nicho: 'jardinería' },
      { match: /libreria|papeler|escolar|book|libro/i, nicho: 'librería y papelería' },
    ];

    for (const { match, nicho } of NICHO_MAP) {
      if (match.test(domainSlug) || match.test(hostname)) {
        return nicho;
      }
    }
    return '';
  } catch {
    return '';
  }
}
