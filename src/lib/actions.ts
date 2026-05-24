"use server"

import { signIn, signOut, auth } from "../auth"
import { getSearchConsoleData, submitGoogleIndexing } from "./google"

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

    const missions = rows.map((row, index) => {
      const fullPageUrl = row.keys[0]
      
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
      const MISSION_TYPES = buildMissionTypes(goldKeyword)
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
