"use server"

import { signIn, signOut, auth } from "../auth"
import { getSearchConsoleData, submitGoogleIndexing } from "./google"
import { GoogleGenerativeAI } from "@google/generative-ai"

export async function login() {
  await signIn("google")
}

export async function logout() {
  await signOut()
}

/**
 * Mission type definitions.
 * We rotate through types to give the user variety.
 */
const buildMissionTypes = (goldKeyword?: string) => [
  {
    type: 'H1',
    title: 'El Guardián del Título',
    descriptionTemplate: (path: string) =>
      goldKeyword
        ? `Esta página (${path}) tiene pocas visitas. Reescribí su H1 incluyendo «${goldKeyword}» para que Google sepa exactamente de qué trata.`
        : `Esta página (${path}) tiene pocas visitas. Revisá y mejorá su etiqueta H1 para que Google la entienda mejor.`,
    xp: 50,
    icon: 'H1',
    color: 'green',
    pistas: goldKeyword
      ? [
          `1. Entrar al UX Builder desde la página a editar.`,
          `2. Ubicar el elemento de título principal y cambiar su etiqueta a H1.`,
          `3. Asegurate de que el H1 contenga la frase «${goldKeyword}» de forma natural.`,
          `4. Aplicar el cambio (Apply) y Guardar (Update).`,
        ]
      : [
          "1. Entrar al UX Builder desde la página a editar.",
          "2. Ubicar el elemento de texto o título y abrir sus opciones.",
          "3. Cambiar la etiqueta a H1, aplicar el cambio (Apply) y Guardar (Update).",
        ],
  },
  {
    type: 'META',
    title: 'Gancho de Clics',
    descriptionTemplate: (path: string) =>
      goldKeyword
        ? `La página ${path} aparece en Google pero nadie hace clic. Escribí una Meta Descripción que incluya «${goldKeyword}» y convenza al usuario de entrar.`
        : `La página ${path} aparece en Google pero nadie hace clic. Mejorá su Meta Descripción para ser más atractivo.`,
    xp: 60,
    icon: '📝',
    color: 'yellow',
    pistas: goldKeyword
      ? [
          `1. Entrar a editar la página en WordPress (Editor normal).`,
          `2. Bajar hasta la sección del plugin SEO y buscar 'Meta descripción'.`,
          `3. Escribir un texto de hasta 160 caracteres que incluya «${goldKeyword}» y un llamado a la acción.`,
          `4. Hacer clic en Guardar o Actualizar.`,
        ]
      : [
          "1. Entrar a editar la página en WordPress (Editor normal).",
          "2. Bajar hasta la sección del plugin SEO y buscar 'Meta descripción'.",
          "3. Escribir el nuevo texto y hacer clic en Guardar o Actualizar.",
        ],
  },
  {
    type: 'ALT',
    title: 'Ojos de Google',
    descriptionTemplate: (path: string) =>
      goldKeyword
        ? `Las imágenes de ${path} no tienen texto ALT con «${goldKeyword}». Describílas correctamente para indexar en Google Imágenes.`
        : `Revisá el texto ALT de las imágenes en ${path} para que Google las indexe correctamente.`,
    xp: 40,
    icon: '🖼️',
    color: 'blue',
    pistas: goldKeyword
      ? [
          `1. Entrar al UX Builder desde la página a editar.`,
          `2. Ubicar la imagen, hacer doble clic y buscar 'Texto Alternativo' (Alt Text).`,
          `3. Escribir una descripción que incluya «${goldKeyword}» (ej: «${goldKeyword} en uso»).`,
          `4. Presionar Apply y luego Guardar (Update).`,
        ]
      : [
          "1. Entrar al UX Builder desde la página a editar.",
          "2. Ubicar la imagen, hacer doble clic y buscar 'Texto Alternativo' (Alt Text).",
          "3. Escribir la descripción de la imagen, presionar Apply y luego Guardar (Update).",
        ],
  },
]

export async function getRealMissions(siteUrl: string, goldKeyword?: string) {
  try {
    const session = await auth()

    if (!session?.accessToken) {
      return { success: false, error: "No hay sesión activa o falta el token de acceso" }
    }

    const rows = await getSearchConsoleData(session.accessToken, siteUrl, goldKeyword)

    if (!rows || rows.length === 0) {
      return { success: true, data: [] }
    }

    // Sort by clicks desc, then impressions desc
    const sortedRows = [...rows].sort((a, b) => {
      const clicksDiff = (b.clicks || 0) - (a.clicks || 0);
      if (clicksDiff !== 0) return clicksDiff;
      return (b.impressions || 0) - (a.impressions || 0);
    });

    const missions = sortedRows.map((row, index) => {
      const fullPageUrl = row.keys[0]
      const rawKeyword = row.keys[1] || ""
      const cleanKeyword = rawKeyword.replace(/\$/g, '').replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '').trim()
      
      let pagePath = fullPageUrl
      try {
        if (fullPageUrl.startsWith('http')) {
          pagePath = new URL(fullPageUrl).pathname
        }
      } catch (e) {
        // keep fullPageUrl as fallback
      }
      
      // Format path for display: human readable
      let displayPath = pagePath;
      if (displayPath === '/') {
        displayPath = 'Página de Inicio (Portada)';
      } else {
        // Remove leading/trailing slashes, replace dashes/slashes with spaces
        displayPath = displayPath.replace(/^\/+|\/+$/g, '').replace(/[-/]/g, ' ');
        // Capitalize first letter
        if (displayPath.length > 0) {
          displayPath = displayPath.charAt(0).toUpperCase() + displayPath.slice(1);
        }
        // Truncate if still too long
        if (displayPath.length > 40) {
          displayPath = displayPath.slice(0, 37) + '...';
        }
      }

      // Rotate through mission types based on index
      const MISSION_TYPES = buildMissionTypes(cleanKeyword || goldKeyword)
      const missionDef = MISSION_TYPES[index % MISSION_TYPES.length]

      return {
        id: `${missionDef.type.toLowerCase()}-${pagePath}`,
        title: missionDef.title,
        description: missionDef.descriptionTemplate(displayPath),
        xp: missionDef.xp,
        page: fullPageUrl,       // Full URL for linking
        pagePath: pagePath,       // Path for display in modal
        type: missionDef.type,
        icon: missionDef.icon,
        color: missionDef.color,
        pistas: missionDef.pistas,
        keyword: cleanKeyword || goldKeyword || "",
        // Real metrics from Search Console
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }
    })

    return { success: true, data: missions }
  } catch (error: any) {
    console.error("Error generating real missions:", error)
    return { success: false, error: error.message || "Error al obtener datos de Search Console" }
  }
}

/**
 * Extracts a specific SEO element from raw HTML using regex.
 */
function extractFromHtml(html: string, type: string): string | string[] | null {
  try {
    if (type === 'H1') {
      const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
      if (match) {
        // Strip inner HTML tags (e.g. <span>)
        return match[1].replace(/<[^>]+>/g, '').trim()
      }
    }

    if (type === 'META') {
      const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i)
      return match ? match[1].trim() : null
    }

    if (type === 'ALT') {
      // Return all alt texts found as an array
      const alts: string[] = []
      const regex = /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi
      let match
      while ((match = regex.exec(html)) !== null) {
        if (match[1].trim()) alts.push(match[1].trim())
      }
      return alts.length > 0 ? alts : null
    }
  } catch (e) {
    console.error('Error extracting from HTML:', e)
  }
  return null
}

/**
 * Decodes HTML entities in a raw string. Called explicitly before normalize.
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    // Must decode in this exact order: &amp; last to avoid double-decoding
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Parche de Puntuación Flexible: Normaliza el texto para evitar rebotes injustos.
 * Decodifica HTML, minúsculas, remueve acentos, y limpia signos ortográficos (puntos, comas, etc)
 */
function normalize(text: string): string {
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

/**
 * Verifies a mission by fetching the live page and comparing the actual tag content.
 */
export async function verifyMission(pageUrl: string, type: string, userInput: string, goldKeyword?: string) {
  if (!pageUrl || !type || !userInput?.trim()) {
    return { success: false, message: 'Faltan datos para verificar.' }
  }

  // Keyword gate: el input DEBE contener la keyword de oro
  if (goldKeyword?.trim()) {
    const normalizedInput = normalize(userInput)
    const normalizedKeyword = normalize(goldKeyword)
    // Verificar palabra por palabra (ignorar stop words de 1-2 letras)
    const keywordWords = normalizedKeyword.split(' ').filter(w => w.length > 2)
    const inputContainsKeyword = keywordWords.length > 0 && keywordWords.every(w => normalizedInput.includes(w))
    if (!inputContainsKeyword) {
      return {
        success: false,
        message: `Tu ${type} no incluye la palabra clave activa «${goldKeyword}». Agregala para que Google entienda de qué trata tu página y así subir posiciones.`,
      }
    }
  }

  let html: string
  try {
    console.log(`[verifyMission] Fetching live page: ${pageUrl}`)
    const finalUrl = pageUrl.includes('?') ? `${pageUrl}&nocache=${Date.now()}` : `${pageUrl}?nocache=${Date.now()}`;
    const response = await fetch(finalUrl, {
      headers: {
        // Mimic a real browser to avoid bot blocks
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return {
        success: false,
        message: `No pude acceder a la página (Error ${response.status}). Verificá que la URL sea pública.`,
      }
    }

    html = await response.text()
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      return { success: false, message: 'La página tardó demasiado en responder (>8s). Intentá de nuevo.' }
    }
    return { success: false, message: `Error al acceder a la página: ${err?.message}` }
  }

  // Extract the real current value from the live HTML
  const liveValue = extractFromHtml(html, type)

  console.log(`[verifyMission] Type: ${type} | Live value: "${Array.isArray(liveValue) ? liveValue.join(' | ') : liveValue}" | User input: "${userInput}"`)

  if (!liveValue || (Array.isArray(liveValue) && liveValue.length === 0)) {
    return {
      success: false,
      liveValue: null,
      message: type === 'H1'
        ? 'No encontramos ningún H1 en tu página. ¡Eso también es un problema SEO!'
        : type === 'META'
        ? 'Tu página no tiene Meta Descripción. ¡Hay que agregarla!'
        : 'No encontramos imágenes con texto ALT en tu página.',
    }
  }

  // Decode HTML entities on the RAW extracted value BEFORE normalize.
  // This is the critical step - normalize receives clean text, not &#8211; etc.
  let cleanLiveValue: string | string[] | null = liveValue
  if (typeof liveValue === 'string') {
    cleanLiveValue = decodeHtmlEntities(liveValue)
  } else if (Array.isArray(liveValue)) {
    cleanLiveValue = liveValue.map(v => decodeHtmlEntities(v))
  }

  console.log(`[verifyMission] Raw liveValue:     "${Array.isArray(liveValue) ? liveValue.join(' | ') : liveValue}"`)
  console.log(`[verifyMission] Decoded liveValue:  "${Array.isArray(cleanLiveValue) ? cleanLiveValue.join(' | ') : cleanLiveValue}"`)
  console.log(`[verifyMission] Normalized input:   "${normalize(userInput)}"`)
  console.log(`[verifyMission] Normalized live:    "${normalize(typeof cleanLiveValue === 'string' ? cleanLiveValue : '')}"`)

  const normalizedInput = normalize(userInput)
  let isMatch = false
  let matchedValue = ''

  if (type === 'ALT') {
    const alts = Array.isArray(cleanLiveValue) ? cleanLiveValue : [cleanLiveValue as string]
    for (const alt of alts) {
      if (typeof alt === 'string') {
        const normalizedAlt = normalize(alt)
        if (normalizedAlt === normalizedInput || normalizedAlt.includes(normalizedInput) || normalizedInput.includes(normalizedAlt)) {
          isMatch = true
          matchedValue = alt
          break
        }
      }
    }
  } else {
    if (typeof cleanLiveValue === 'string') {
      const normalizedLive = normalize(cleanLiveValue)
      isMatch = normalizedLive === normalizedInput || normalizedLive.includes(normalizedInput) || normalizedInput.includes(normalizedLive)
      matchedValue = cleanLiveValue
    }
  }

  if (isMatch) {
    return {
      success: true,
      liveValue: matchedValue,
      message: `¡Lo encontramos en tu web! El ${type} dice exactamente: "${matchedValue}"`,
    }
  } else {
    // Limitar los valores para no mostrar un texto gigante en caso de error
    const displayValue = Array.isArray(liveValue) 
      ? (liveValue.length > 3 ? liveValue.slice(0, 3).join(', ') + '...' : liveValue.join(', '))
      : liveValue

    return {
      success: false,
      liveValue: Array.isArray(liveValue) ? liveValue[0] : liveValue,
      message: type === 'ALT'
        ? `No encontramos tu texto. Se detectaron ${Array.isArray(liveValue) ? liveValue.length : 1} imágenes (ej: ${displayValue}). ¿Ya aplicaste el cambio en tu sitio?`
        : `Tu ${type} actual en la web dice: "${decodeHtmlEntities(Array.isArray(liveValue) ? liveValue[0] : liveValue as string)}". ¿Ya aplicaste el cambio en tu sitio?`,
    }
  }
}

/**
 * Verifies if a specific phrase exists within the text content of a page.
 */
export async function verifyContentMission(pageUrl: string, searchPhrase: string) {
  if (!pageUrl || !searchPhrase?.trim()) {
    return { success: false, message: 'Faltan datos para verificar.' }
  }

  let html: string
  try {
    console.log(`[verifyContentMission] Fetching live page: ${pageUrl}`)
    const finalUrl = pageUrl.includes('?') ? `${pageUrl}&nocache=${Date.now()}` : `${pageUrl}?nocache=${Date.now()}`;
    const response = await fetch(finalUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return {
        success: false,
        message: `No pude acceder a la página (Error ${response.status}). Verificá que la URL sea pública.`,
      }
    }

    html = await response.text()
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      return { success: false, message: 'La página tardó demasiado en responder (>8s). Intentá de nuevo.' }
    }
    return { success: false, message: `Error al acceder a la página: ${err?.message}` }
  }

  // Very basic strip of script/style tags before checking content
  const bodyContent = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '); // remove all html tags

  console.log("=== TEXTO LIMPIO EXTRAÍDO DE LA WEB ===", bodyContent.substring(0, 500));

  const normalizedLive = normalize(bodyContent)
  const normalizedInput = normalize(searchPhrase)

  console.log("=== COMPARACIÓN NORMALIZADA ===");
  console.log("BUSCANDO (Input):", normalizedInput);

  // Word-by-word match of main keywords (excluding Spanish stop words)
  const stopWords = new Set(['de', 'la', 'el', 'en', 'y', 'a', 'los', 'con', 'por', 'para', 'un', 'una', 'unos', 'unas', 'del', 'al', 'o', 'u', 'es', 'son', 'se', 'su', 'sus']);
  const inputWords = normalizedInput.split(' ').map(w => w.trim()).filter(w => w.length > 0);
  const keywordsToVerify = inputWords.filter(w => !stopWords.has(w) && w.length > 2);
  const finalKeywords = keywordsToVerify.length > 0 ? keywordsToVerify : inputWords;

  const isMatch = finalKeywords.length > 0 && finalKeywords.every(word => normalizedLive.includes(word));

  console.log("KEYWORDS TO VERIFY:", finalKeywords);
  console.log("IS MATCH?:", isMatch);

  if (isMatch) {
    return {
      success: true,
      message: `¡Lo encontramos en tu web! Las palabras clave principales están presentes.`,
    }
  } else {
    return {
      success: false,
      message: `No encontramos tu frase exacta en la web. ¿Ya aplicaste el cambio y vaciaste la caché?`,
    }
  }
}

export async function requestGoogleIndexing(urlToIndex: string) {
  try {
    const session = await auth();

    if (!session?.accessToken) {
      return { success: false, message: "No hay sesión activa o falta el token de acceso" };
    }

    let siteUrl = "";
    try {
      const parsed = new URL(urlToIndex);
      siteUrl = `${parsed.protocol}//${parsed.host}/`;
    } catch (e) {
      siteUrl = urlToIndex; // fallback
    }

    return await submitGoogleIndexing(session.accessToken, siteUrl, urlToIndex);
  } catch (error: any) {
    console.error("Error requesting Google indexing:", error);
    return { success: false, message: error.message || "Error al solicitar indexación." };
  }
}

const metadataCache = new Map<string, { title: string; description: string; h1: string }>();


/**
 * Intenta extraer el nicho/rubro del sitio a partir de su URL y del nombre del dominio.
 */
function inferNichoFromUrl(siteUrl: string): string {
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

/**
 * Escanea metadatos Title, Description y H1 de forma rápida con timeout de 4 segundos.
 */
async function scrapeMetadata(siteUrl: string): Promise<{ title: string; description: string; h1: string }> {
  const result = { title: "", description: "", h1: "" };
  if (!siteUrl) return result;
  
  let targetUrl = siteUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }
  
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
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
      result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    
    // Extract Meta Description
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }
    
    // Extract H1
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match) {
      result.h1 = h1Match[1].replace(/<[^>]+>/g, '').trim();
    }
  } catch (error) {
    console.error("Error scraping metadata:", error);
  }
  
  return result;
}

/**
 * Server Action híbrida para obtener sugerencias predictivas SEO con IA (Gemini).
 */
export async function getAIPredictiveSuggestions(siteUrl: string, seedKeyword: string, excludedWords?: string) {
  try {
    const normalizedSiteUrl = siteUrl.trim().toLowerCase().replace(/\/$/, '');

    // 1. Scraping metadatos con caché y fallback a nicho genérico
    let meta = { title: "", description: "", h1: "" };
    let inferredNicho = "";
    try {
      inferredNicho = inferNichoFromUrl(siteUrl);
      
      let cached = metadataCache.get(normalizedSiteUrl);
      if (!cached) {
        cached = await scrapeMetadata(siteUrl);
        metadataCache.set(normalizedSiteUrl, cached);
      }
      meta = cached;
    } catch (scrapeErr: any) {
      console.warn("Scraper step failed, ignoring scrape context:", scrapeErr.message);
      // Falla el scraper: se ignora y se continúa con nicho genérico/derivable
    }

    const businessNiche = [inferredNicho, meta.title, meta.description, meta.h1]
      .filter(Boolean)
      .join(" | ") || "Nicho de negocio o ecommerce general";

    // 2. Obtener data de Search Console
    let gscRows: any[] = [];
    try {
      const session = await auth();
      if (session?.accessToken) {
        gscRows = await getSearchConsoleData(session.accessToken, siteUrl, seedKeyword);
      }
    } catch (err: any) {
      console.warn("GSC step failed, ignoring GSC context:", err.message);
      // Falla GSC: se ignora y se usa solo Scraper+IA
    }

    // 3. Obtener API key
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const match = envContent.match(/^GEMINI_API_KEY\s*=\s*(.*)$/m);
          if (match) {
            apiKey = match[1].trim().replace(/['"]/g, '');
          }
        }
      } catch (err) {
        console.warn("Could not read fallback .env.local file:", err);
      }
    }

    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY no configurada en las variables de entorno." };
    }

    // Parse excluded words
    const excludedList = excludedWords
      ? excludedWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
      : [];

    const hasGscData = gscRows && gscRows.length > 0;
    
    let gscContext = "";
    if (hasGscData) {
      gscContext = gscRows.map(row => {
        const page = row.keys[0];
        const query = row.keys[1];
        return `Página: ${page}, Query: ${query}, Clicks: ${row.clicks}, Impresiones: ${row.impressions}`;
      }).join("\n");
    }

    const systemInstructions = `
Actúas como un consultor SEO experto de nivel premium. Tu objetivo es generar exactamente 10 palabras clave de cola larga (long-tail) que tengan una alta intención comercial o transaccional, y en menor medida informacional.

Contexto del negocio:
- URL del sitio: ${siteUrl}
- Nicho/Metadatos detectados: ${businessNiche}
- Palabra clave semilla: "${seedKeyword}"
${hasGscData ? `\nDatos reales de Google Search Console para esta semilla:\n${gscContext}` : "\n[AVISO CRÍTICO] La API de Search Console no devolvió resultados para esta semilla (búsqueda vacía). Debes apoyarte FUERTEMENTE en el nicho del negocio, el contenido de los metadatos y la palabra clave semilla para inventar de manera predictiva 10 misiones espectaculares y altamente relevantes."}

Reglas estrictas de generación:
1. Genera EXACTAMENTE 10 sugerencias de palabras clave de cola larga (long-tail).
2. Cada palabra clave debe contener de manera obligatoria la palabra clave semilla "${seedKeyword}" (o variaciones gramaticales muy cercanas).
3. Cada sugerencia debe clasificarse con:
   - "keyword": El término de búsqueda exacto.
   - "intent": Debe ser "transaccional" o "informacional".
   - "relevancia": Debe ser "alta", "media" o "baja".
4. NUNCA incluyas caracteres especiales como '$' ni ningún otro símbolo extraño al inicio del término. Todas las palabras clave deben estar completamente limpias.
5. Evita usar las siguientes palabras excluidas: ${excludedList.join(", ") || "Ninguna"}.
6. Devuelve la respuesta ESTRICTAMENTE en formato JSON con el siguiente esquema de array, sin bloques de código markdown ni explicaciones adicionales:
[
  { "keyword": "...", "intent": "transaccional" | "informacional", "relevancia": "alta" | "media" | "baja" }
]
`;

    // 4. Llamar a la API de Gemini
    let responseText = "";
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-flash-latest",
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent(
        {
          contents: [{ role: 'user', parts: [{ text: systemInstructions }] }]
        },
        {
          timeout: 30000 // Timeout de 30 segundos
        }
      );
      responseText = await result.response.text();
    } catch (geminiErr: any) {
      console.error("Gemini API call failed:", geminiErr);
      return { success: false, error: "El cerebro está ocupado, reintentá en 5 segundos" };
    }

    // 5. Parsear y Validar JSON
    let parsed: any[] = [];
    try {
      const jsonStart = responseText.indexOf('[');
      const jsonEnd = responseText.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } else {
        parsed = JSON.parse(responseText);
      }
    } catch (parseErr) {
      console.error("Error parsing Gemini JSON response:", responseText, parseErr);
      return { success: false, error: "El cerebro está ocupado, reintentá en 5 segundos" };
    }

    if (!Array.isArray(parsed)) {
      return { success: false, error: "El cerebro está ocupado, reintentá en 5 segundos" };
    }

    // 6. Sanitizar y mapear
    const finalSuggestions = parsed
      .map((item: any) => {
        if (!item) return null;
        const rawKeyword = item.keyword || item.text || "";
        
        // Limpieza agresiva de caracteres extraños ($) y basura inicial
        const cleanKeyword = rawKeyword
          .replace(/\$/g, '')
          .replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '')
          .trim();

        if (!cleanKeyword) return null;

        // Comprobar exclusión
        const lowerKeyword = cleanKeyword.toLowerCase();
        const isExcluded = excludedList.some(ex => lowerKeyword.includes(ex));
        if (isExcluded) return null;

        const mappedIntent = (item.intent === 'informacional' || item.intent === 'atraccion') 
          ? 'atraccion' 
          : 'venta';

        return {
          text: cleanKeyword,
          intent: mappedIntent
        };
      })
      .filter(Boolean);

    return {
      success: true,
      suggestions: finalSuggestions,
      nicho: inferredNicho || "General"
    };

  } catch (error: any) {
    console.error("Error in getAIPredictiveSuggestions:", error);
    return { success: false, error: "El cerebro está ocupado, reintentá en 5 segundos" };
  }
}
