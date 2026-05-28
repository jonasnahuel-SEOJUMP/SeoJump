"use server"

import fs from "fs"
import path from "path"
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
 * Sanitiza y valida las entradas del usuario (keywords y URLs) antes de ser procesadas.
 */
function sanitizeInput(text: string, type: 'keyword' | 'url'): { isValid: boolean; sanitized: string; error?: string } {
  if (!text || !text.trim()) {
    return { 
      isValid: false, 
      sanitized: "", 
      error: `La entrada del ${type === 'keyword' ? 'término de búsqueda' : 'sitio web'} está vacía o contiene solo espacios.` 
    };
  }

  const clean = text.trim();

  if (type === 'keyword') {
    // Permitir letras, números, espacios y acentos comunes
    const cleanKeyword = clean.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, "");
    if (cleanKeyword.length < 2) {
      return { 
        isValid: false, 
        sanitized: clean, 
        error: "La palabra clave es demasiado corta. Debe tener al menos 2 caracteres válidos." 
      };
    }
    if (cleanKeyword.length > 80) {
      return { 
        isValid: false, 
        sanitized: clean, 
        error: "La palabra clave es demasiado larga. Por favor usa un término de hasta 80 caracteres." 
      };
    }
    return { isValid: true, sanitized: cleanKeyword };
  } else {
    const cleanUrl = clean.toLowerCase();
    // Expresión regular para validar dominio o URL básico
    const domainRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    if (!domainRegex.test(cleanUrl)) {
      return { 
        isValid: false, 
        sanitized: clean, 
        error: "La URL ingresada no es válida. Asegurate de usar un formato de dominio correcto (ej: miweb.com)." 
      };
    }
    return { isValid: true, sanitized: cleanUrl };
  }
}

/**
 * Guarda un registro persistente del error en un archivo JSON local en el servidor.
 */
function logErrorToFile(actionName: string, input: any, status: string | number, message: string) {
  try {
    const logFilePath = path.join(process.cwd(), "error_log.json");
    const logEntry = {
      action: actionName,
      input,
      timestamp: new Date().toISOString(),
      status: String(status),
      message: message || "Error desconocido"
    };

    let logs: any[] = [];
    if (fs.existsSync(logFilePath)) {
      try {
        const fileContent = fs.readFileSync(logFilePath, "utf8");
        logs = JSON.parse(fileContent);
        if (!Array.isArray(logs)) {
          logs = [];
        }
      } catch (parseErr) {
        console.error("Error parsing existing error_log.json, resetting:", parseErr);
        logs = [];
      }
    }

    logs.push(logEntry);

    // Conservar solo los últimos 100 registros para evitar crecimiento infinito
    if (logs.length > 100) {
      logs = logs.slice(logs.length - 100);
    }

    fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf8");
    console.log(`[API Log] Error guardado exitosamente en error_log.json para acción ${actionName}`);
  } catch (fsErr) {
    console.error("No se pudo escribir en error_log.json:", fsErr);
  }
}

/**
 * Realiza una llamada directa a la API REST de Google Gemini, omitiendo el SDK.
 */
async function callGeminiREST(apiKey: string, promptText: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
  console.log(`[API REST Debug] Llamando directamente a Gemini REST API...`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google REST API returned status ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
    throw new Error("La API de Google devolvió una respuesta vacía.");
  }
  return text;
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
  // Sanitizar entradas
  const urlSanit = sanitizeInput(siteUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  const cleanSiteUrl = urlSanit.sanitized;

  let cleanGoldKeyword = "";
  if (goldKeyword) {
    const kwSanit = sanitizeInput(goldKeyword, 'keyword');
    if (!kwSanit.isValid) {
      return { success: false, error: kwSanit.error };
    }
    cleanGoldKeyword = kwSanit.sanitized;
  }

  try {
    const session = await auth()

    if (!session?.accessToken) {
      return { success: false, error: "No hay sesión activa o falta el token de acceso" }
    }

    const rows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanGoldKeyword || undefined)

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
    logErrorToFile(
      "getRealMissions",
      { siteUrl: cleanSiteUrl, goldKeyword: cleanGoldKeyword },
      error.status || "500",
      error.message || String(error)
    );
    return { success: false, error: error.message || "Error al obtener datos de Search Console" }
  }
}

function extractFromHtml(html: string, type: string): string | string[] | null {
  try {
    if (type === 'H1') {
      const headings: string[] = [];
      
      // Extract H1s
      const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
      let match;
      while ((match = h1Regex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) headings.push(text);
      }
      
      // Extract H2s (as requested for thoroughness)
      const h2Regex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
      while ((match = h2Regex.exec(html)) !== null) {
        const text = match[1].replace(/<[^>]+>/g, '').trim();
        if (text) headings.push(text);
      }
      
      return headings.length > 0 ? headings : null;
    }

    if (type === 'META') {
      const metaValues: string[] = [];
      
      // Meta description
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
      if (descMatch && descMatch[1].trim()) metaValues.push(descMatch[1].trim());
      
      // Meta keywords
      const keywMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i)
            || html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']keywords["']/i);
      if (keywMatch && keywMatch[1].trim()) metaValues.push(keywMatch[1].trim());
      
      // Page title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch && titleMatch[1].trim()) {
        metaValues.push(titleMatch[1].replace(/<[^>]+>/g, '').trim());
      }
      
      return metaValues.length > 0 ? metaValues : null;
    }

    if (type === 'ALT') {
      const alts: string[] = [];
      const regex = /<img[^>]+alt=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        if (match[1].trim()) alts.push(match[1].trim());
      }
      return alts.length > 0 ? alts : null;
    }
  } catch (e) {
    console.error('Error extracting from HTML:', e);
  }
  return null;
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
    console.log(`[verifyMission] Fetching live page (no-cache): ${pageUrl}`)
    const finalUrl = pageUrl.includes('?') ? `${pageUrl}&nocache=${Date.now()}` : `${pageUrl}?nocache=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
  const normalizedKeyword = goldKeyword ? normalize(goldKeyword) : ''
  let isMatch = false
  let matchedValue = ''

  const extractedList = Array.isArray(cleanLiveValue) ? cleanLiveValue : [cleanLiveValue as string]

  for (const val of extractedList) {
    if (typeof val === 'string') {
      const normalizedLive = normalize(val)
      
      // 1. Matches user input exactly or contains/is contained by it
      const matchesInput = normalizedLive === normalizedInput || normalizedLive.includes(normalizedInput) || normalizedInput.includes(normalizedLive);
      
      // 2. Contains the target keyword (direct comparison)
      const matchesKeyword = normalizedKeyword && (normalizedLive === normalizedKeyword || normalizedLive.includes(normalizedKeyword));
      
      if (matchesInput || matchesKeyword) {
        isMatch = true
        matchedValue = val
        break
      }
    }
  }

  if (isMatch) {
    return {
      success: true,
      liveValue: matchedValue,
      message: `¡Lo encontramos en tu web! El contenido dice: "${matchedValue}"`,
    }
  } else {
    // Limitar los valores para no mostrar un texto gigante en caso de error
    const displayValue = Array.isArray(cleanLiveValue) 
      ? (cleanLiveValue.length > 3 ? cleanLiveValue.slice(0, 3).join(', ') + '...' : cleanLiveValue.join(', '))
      : cleanLiveValue

    return {
      success: false,
      liveValue: Array.isArray(cleanLiveValue) ? cleanLiveValue[0] : cleanLiveValue,
      message: type === 'ALT'
        ? `No encontramos tu texto. Se detectaron ${Array.isArray(cleanLiveValue) ? cleanLiveValue.length : 1} imágenes (ej: ${displayValue}). ¿Ya aplicaste el cambio en tu sitio?`
        : `Tu ${type} actual detectado en la web dice: "${decodeHtmlEntities(Array.isArray(cleanLiveValue) ? cleanLiveValue[0] : cleanLiveValue as string)}". ¿Ya aplicaste el cambio en tu sitio?`,
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
    console.log(`[verifyContentMission] Fetching live page (no-cache): ${pageUrl}`)
    const finalUrl = pageUrl.includes('?') ? `${pageUrl}&nocache=${Date.now()}` : `${pageUrl}?nocache=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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
  // Sanitizar entradas
  const urlSanit = sanitizeInput(siteUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  const cleanSiteUrl = urlSanit.sanitized;

  const kwSanit = sanitizeInput(seedKeyword, 'keyword');
  if (!kwSanit.isValid) {
    return { success: false, error: kwSanit.error };
  }
  const cleanSeedKeyword = kwSanit.sanitized;

  try {
    const normalizedSiteUrl = cleanSiteUrl.replace(/\/$/, '');

    // 1. Scraping metadatos con caché y fallback a nicho genérico
    let meta = { title: "", description: "", h1: "" };
    let inferredNicho = "";
    try {
      inferredNicho = inferNichoFromUrl(cleanSiteUrl);
      
      let cached = metadataCache.get(normalizedSiteUrl);
      if (!cached) {
        cached = await scrapeMetadata(cleanSiteUrl);
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
        gscRows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanSeedKeyword);
      }
    } catch (err: any) {
      console.warn("GSC step failed, ignoring GSC context:", err.message);
      // Falla GSC: se ignora y se usa solo Scraper+IA
    }

    // 3. Obtener API key y depuración
    console.log("GEMINI_API_KEY exists in process.env:", !!process.env.GEMINI_API_KEY);
    
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY no configurada en las variables de entorno de la plataforma.");
      return { 
        success: false, 
        error: "GEMINI_API_KEY no configurada. Por favor, definí la clave en el panel de configuración de la plataforma (Vercel/Render -> Environment Variables)." 
      };
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
- URL del sitio: ${cleanSiteUrl}
- Nicho/Metadatos detectados: ${businessNiche}
- Palabra clave semilla: "${cleanSeedKeyword}"
${hasGscData ? `\nDatos reales de Google Search Console para esta semilla:\n${gscContext}` : "\n[AVISO CRÍTICO] La API de Search Console no devolvió resultados para esta semilla (búsqueda vacía). Debes apoyarte FUERTEMENTE en el nicho del negocio, el contenido de los metadatos y la palabra clave semilla para inventar de manera predictiva 10 misiones espectaculares y altamente relevantes."}

Regla de la Página de Inicio (CRÍTICA):
Antes de sugerir un H1, título o palabra clave de optimización, analiza la URL. Si la URL corresponde a la página principal o portada (raíz del dominio, ej: misitio.com/), NUNCA sugieras optimizar para un producto o servicio específico (ej: una lata de atún, un desengrasante Alumax). La página de inicio debe optimizarse siempre para la Marca y la Categoría Global del negocio (ej: Supermercado, Tienda de Detailing, etc.). Solo sugiere palabras clave específicas de productos si la URL corresponde a una página interna o de blog.

Nexo con la Semilla (Seed Keyword):
Todas las sugerencias deben desprenderse lógicamente y respetar la palabra clave semilla "${cleanSeedKeyword}" que el usuario investiga en la Fase 1, para que el flujo de misiones mantenga coherencia absoluta.

Reglas estrictas de generación:
1. Genera EXACTAMENTE 10 sugerencias de palabras clave de cola larga (long-tail).
2. Cada palabra clave debe contener de manera obligatoria la palabra clave semilla "${cleanSeedKeyword}" (o variaciones gramaticales muy cercanas).
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

    // 4. Llamar a la API de Gemini con mecanismo de reintento (retry) y retroceso exponencial (exponential backoff)
    let responseText = "";
    const maxRetries = 3;
    let attempt = 0;
    let delayMs = 1000;

    while (attempt < maxRetries) {
      try {
        console.log(`Initializing GoogleGenerativeAI (Attempt ${attempt + 1}/${maxRetries}) using model: models/gemini-3.5-flash`);
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: "models/gemini-3.5-flash"
        });

        // Intercept global fetch to log SDK requests
        const originalFetch = global.fetch;
        // @ts-ignore
        global.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
          console.log("[API Debug] SDK is fetching URL:", input.toString());
          console.log("[API Debug] Fetch init options:", JSON.stringify(init || {}));
          return originalFetch(input, init);
        };

        try {
          const result = await model.generateContent(
            {
              contents: [{ role: 'user', parts: [{ text: systemInstructions }] }]
            },
            {
              timeout: 30000 // Timeout de 30 segundos
            }
          );
          responseText = await result.response.text();
        } finally {
          // Restore original fetch
          global.fetch = originalFetch;
        }
        break; // Éxito, salir del bucle
      } catch (geminiErr: any) {
        console.warn("[API Debug] SDK call failed. Trying direct REST API fallback...", geminiErr.message || geminiErr);
        try {
          responseText = await callGeminiREST(apiKey, systemInstructions);
          console.log("[API Debug] Direct REST API fallback succeeded!");
          break; // Éxito, salir del bucle
        } catch (restErr: any) {
          console.error("[API Debug] REST fallback failed as well:", restErr.message || restErr);
        }

        attempt++;
        
        // Log detailed error info on the server console
        console.error(`[API Debug] Attempt ${attempt} failed.`);
        console.error(`[API Debug] Error Message: ${geminiErr.message}`);
        console.error(`[API Debug] Error Status: ${geminiErr.status || "N/A"}`);
        console.error("FULL GEMINI ERROR OBJECT:", geminiErr);
        
        // Log persistently to error_log.json on the server
        logErrorToFile(
          "getAIPredictiveSuggestions", 
          { siteUrl: cleanSiteUrl, seedKeyword: cleanSeedKeyword }, 
          geminiErr.status || "503", 
          geminiErr.message || String(geminiErr)
        );
        
        if (attempt >= maxRetries) {
          // Build user-friendly error message instead of raw API JSON
          let userMessage = "";
          const errMsg = String(geminiErr.message || geminiErr).toLowerCase();
          if (geminiErr.status === 429 || errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
            userMessage = "La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo.";
          } else if (geminiErr.status === 404 || errMsg.includes("404") || errMsg.includes("not found")) {
            userMessage = "El modelo de IA no está disponible temporalmente. Intentá de nuevo en unos minutos.";
          } else {
            userMessage = "Error temporal al conectar con la IA. Intentá de nuevo en unos segundos.";
          }
          return { 
            success: false, 
            error: userMessage
          };
        }
        
        console.log(`Waiting ${delayMs}ms before retrying Gemini API...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 2; // Retroceso exponencial
      }
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
    } catch (parseErr: any) {
      console.error("Error parsing Gemini JSON response:", responseText, parseErr);
      return { 
        success: false, 
        error: `JSON Parse Failed: ${parseErr.message}. Response: "${responseText}"`,
        stack: parseErr.stack
      };
    }

    if (!Array.isArray(parsed)) {
      return { 
        success: false, 
        error: "La IA no devolvió un listado válido (no es un array JSON).",
        stack: new Error("Parsed response is not an array").stack
      };
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
    logErrorToFile(
      "getAIPredictiveSuggestions_Global",
      { siteUrl: cleanSiteUrl, seedKeyword: cleanSeedKeyword },
      error.status || "500",
      error.message || String(error)
    );
    return { 
      success: false, 
      error: `Inesperado: ${error.message}`,
      stack: error.stack
    };
  }
}

// ─── Home-page safety helper ───────────────────────────────────────────────
// Returns true if the URL is the root / home page of the domain.
function isHomePage(pageUrl: string, siteUrl: string): boolean {
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

export async function getQuickWins(siteUrl: string, goldKeyword?: string) {
  const urlSanit = sanitizeInput(siteUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  const cleanSiteUrl = urlSanit.sanitized;

  let cleanGoldKeyword = "";
  if (goldKeyword) {
    const kwSanit = sanitizeInput(goldKeyword, 'keyword');
    if (kwSanit.isValid) {
      cleanGoldKeyword = kwSanit.sanitized;
    }
  }

  try {
    const session = await auth();

    let inferredNicho = "";
    let homeMeta = { title: "", description: "", h1: "" };
    try {
      inferredNicho = inferNichoFromUrl(cleanSiteUrl);
      homeMeta = await scrapeMetadata(cleanSiteUrl);
    } catch (e) {
      console.warn("Error obteniendo metadatos de la home para Quick Wins:", e);
    }

    const businessNiche = [inferredNicho, homeMeta.title, homeMeta.description, homeMeta.h1]
      .filter(Boolean)
      .join(" | ") || "Nicho de negocio general";

    let isMockData = false;
    let gscRows: any[] = [];
    if (session?.accessToken) {
      try {
        gscRows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanGoldKeyword || undefined, 100);
      } catch (err: any) {
        console.warn("Fallo al obtener datos de GSC para Quick Wins:", err.message);
        isMockData = true;
      }
    } else {
      isMockData = true;
    }

    let candidates = gscRows.filter(row => {
      const pos = row.position;
      return pos >= 8 && pos <= 15;
    });

    candidates.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));

    const opportunities: any[] = [];
    for (const cand of candidates.slice(0, 3)) {
      const pageUrl = cand.keys[0];
      const query = cand.keys[1];
      let pageMeta = { title: "", description: "", h1: "" };
      try {
        pageMeta = await scrapeMetadata(pageUrl);
      } catch (e) {}
      opportunities.push({
        page: pageUrl,
        keyword: query,
        clicks: cand.clicks || 0,
        impressions: cand.impressions || 0,
        position: cand.position,
        currentTitle: pageMeta.title || "",
        currentDescription: pageMeta.description || "",
        currentH1: pageMeta.h1 || ""
      });
    }

    if (opportunities.length < 3) {
      const niche = inferredNicho || 'general';

      // ── Home-page safe keyword: never inject raw product keyword for the Home ──
      // The home should represent the brand/category, not a specific product.
      const homeNicheKeyword = (() => {
        const nicheMap: Record<string, string> = {
          'detailing vehicular': 'tienda de car detailing',
          'calzado': 'zapatería online argentina',
          'indumentaria': 'ropa de diseño argentina',
          'gastronomía': 'restaurant y delivery',
          'general': 'tienda online argentina',
        };
        return nicheMap[niche] || nicheMap['general'];
      })();

      const fallbackTemplates: any = {
        'detailing vehicular': [
          // ⚠️ Home: uses brand/category keyword, NOT raw goldKeyword
          { path: '', keyword: homeNicheKeyword, pos: 9.4, cl: 15, imp: 240 },
          { path: '/servicios', keyword: cleanGoldKeyword ? `${cleanGoldKeyword} premium` : 'limpieza de tapizados', pos: 11.2, cl: 8, imp: 180 },
          { path: '/productos', keyword: cleanGoldKeyword ? `comprar ${cleanGoldKeyword}` : 'cera para autos importada', pos: 13.8, cl: 3, imp: 95 }
        ],
        'calzado': [
          { path: '', keyword: homeNicheKeyword, pos: 8.7, cl: 25, imp: 310 },
          { path: '/botas', keyword: cleanGoldKeyword ? `${cleanGoldKeyword} de cuero` : 'botas de cuero mujer', pos: 10.5, cl: 12, imp: 190 },
          { path: '/zapatillas', keyword: cleanGoldKeyword ? `${cleanGoldKeyword} urbanas` : 'zapatillas urbanas comodas', pos: 14.2, cl: 4, imp: 110 }
        ],
        'indumentaria': [
          { path: '', keyword: homeNicheKeyword, pos: 9.1, cl: 18, imp: 270 },
          { path: '/remeras', keyword: cleanGoldKeyword ? `${cleanGoldKeyword} de algodon` : 'remeras estampadas algodon', pos: 12.0, cl: 9, imp: 150 },
          { path: '/camperas', keyword: cleanGoldKeyword ? `comprar ${cleanGoldKeyword}` : 'camperas de abrigo impermeable', pos: 13.5, cl: 3, imp: 80 }
        ],
        'gastronomía': [
          { path: '', keyword: homeNicheKeyword, pos: 8.9, cl: 22, imp: 290 },
          { path: '/menu', keyword: cleanGoldKeyword ? `platos de ${cleanGoldKeyword}` : 'platos del dia precios', pos: 10.8, cl: 11, imp: 170 },
          { path: '/reserva', keyword: cleanGoldKeyword ? `reservar ${cleanGoldKeyword}` : 'reservar mesa cena online', pos: 13.1, cl: 4, imp: 90 }
        ],
        'general': [
          { path: '', keyword: homeNicheKeyword, pos: 9.8, cl: 14, imp: 220 },
          { path: '/productos', keyword: cleanGoldKeyword ? `${cleanGoldKeyword} con descuento` : 'productos con descuento', pos: 11.5, cl: 7, imp: 130 },
          { path: '/contacto', keyword: cleanGoldKeyword ? `contacto para ${cleanGoldKeyword}` : 'atencion al cliente inmediata', pos: 14.0, cl: 2, imp: 75 }
        ]
      };

      const templates = fallbackTemplates[niche] || fallbackTemplates['general'];
      let idx = 0;
      while (opportunities.length < 3 && idx < templates.length) {
        const t = templates[idx];
        const pageUrl = cleanSiteUrl.replace(/\/$/, '') + t.path;
        
        if (!opportunities.some(o => o.page === pageUrl)) {
          let pageMeta = { title: "", description: "", h1: "" };
          if (t.path === '') {
            pageMeta = homeMeta;
          } else {
            try {
              pageMeta = await scrapeMetadata(pageUrl);
            } catch (e) {}
          }
          opportunities.push({
            page: pageUrl,
            // ⚠️ Hard-coded safety: Home always gets the brand/category keyword
            keyword: isHomePage(pageUrl, cleanSiteUrl) ? homeNicheKeyword : t.keyword,
            clicks: t.cl,
            impressions: t.imp,
            position: t.pos,
            currentTitle: pageMeta.title || "",
            currentDescription: pageMeta.description || "",
            currentH1: pageMeta.h1 || ""
          });
        }
        idx++;
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY no configurada.");
      return { success: false, error: "GEMINI_API_KEY no configurada en las variables de entorno." };
    }

    // ── Build domain info for the prompt (e.g. "55detailshop.com.ar") ──
    const domainName = (() => { try { return new URL(cleanSiteUrl).hostname; } catch { return cleanSiteUrl; } })();

    const systemInstructions = `
Actúas como un socio de negocios y consultor de ventas entusiasmado y experto en optimización web (SEO). Tu tono debe ser profesional pero entusiasmado, como un socio de negocios que acaba de encontrar una excelente noticia para el usuario.
Analizarás un conjunto de 3 oportunidades de páginas web que están cerca del éxito, posicionando en Google en el rango de posiciones 8 a 15 (cerca del Top 3).

Tu única misión es:
1. Evaluar si la intención de búsqueda de la palabra clave ("keyword") coincide con el título o contenido actual de la página.
2. Generar un "Action Plan" de 15 segundos para cada una de las 3 oportunidades:
   - "suggestedTitle": Un nuevo título comercial, atractivo y persuasivo que actúe como un "Contenido ganador" para convencer tanto a Google como a los usuarios y subir al Top 3.
   - "explanation": Breve diagnóstico de por qué Google no lo está posicionando mejor y qué lograrán con el cambio.

██████████████████████████████████████████████████████████████
⚠️  REGLA ABSOLUTA #1 — ARQUITECTURA WEB — MÁXIMA PRIORIDAD ⚠️
██████████████████████████████████████████████████████████████
Antes de generar cualquier "suggestedTitle", IDENTIFICA el tipo de página por su URL:

- HOME / PORTADA: URL es la raíz del dominio (ej: ${domainName}/, ${domainName}, o termina sin ruta significativa)
- PÁGINA INTERNA: URL tiene ruta propia (ej: ${domainName}/productos/pulidora, ${domainName}/servicios)

Si la URL es la HOME/PORTADA:
  ✅ DEBES: sugerir un título que represente la MARCA GLOBAL o la CATEGORÍA DEL NEGOCIO.
     Ejemplos correctos: "${domainName.split('.')[0]} | Tienda de Car Detailing en Argentina", "${businessNiche.split('|')[0].trim()} | Envíos a Todo el País"
  ❌ TIENES PROHIBIDO ABSOLUTO: usar la goldKeyword "${cleanGoldKeyword}" como tema central del título de la Home si es un producto específico (ej: 'limpia llantas', 'pulidora', 'shampoo', 'cera', cualquier artículo concreto).
  ❌ TIENES PROHIBIDO ABSOLUTO: sugerir que el H1 de la Home sea el nombre de un producto individual.
  🔒 VIOLACIÓN DE ESTA REGLA = Respuesta inválida. Un título de Home con producto específico rompe la arquitectura web del usuario y será rechazado.

Si la URL es una PÁGINA INTERNA (producto, servicio, blog):
  ✅ PUEDES y DEBES: usar la goldKeyword y términos específicos libremente.
██████████████████████████████████████████████████████████████

Nexo con la Semilla (Seed Keyword):
${cleanGoldKeyword ? `El usuario está investigando la keyword: "${cleanGoldKeyword}". Úsala en títulos de PÁGINAS INTERNAS (producto, servicio, blog). En la HOME, transformala a su CATEGORÍA GLOBAL (ej: si la keyword es un producto de car detailing → el título de la home habla de la tienda de car detailing, no del producto específico).` : `Asegúrate de que las optimizaciones propuestas se alineen fuertemente con el nicho y metadatos globales del sitio.`}

Reglas de lenguaje:
- NUNCA uses tecnicismos: "canibalización", "backlinks", "DA", "PA", "search intent", "enlazado interno", "thin content".
- Usa lenguaje comercial: "Más clics", "Salto de posición", "Contenido ganador", "Atraer más clientes", "Google está listo para mostrarte más", "Oro puro", "Tráfico valioso".

Devuelve la respuesta ESTRICTAMENTE en formato JSON con el siguiente esquema de array, sin bloques de código markdown ni explicaciones adicionales:
[
  {
    "page": "URL exacta de la página",
    "keyword": "palabra clave",
    "position": número de posición actual,
    "clicks": número de clics actuales,
    "impressions": número de impresiones actuales,
    "intentMatches": true o false (si la intención de la palabra clave coincide razonablemente con el título/contenido),
    "suggestedTitle": "Título sugerido para subir al Top 3 (Contenido ganador)",
    "explanation": "Explicación entusiasta y comercial de por qué no está en el Top 3 y cómo este título ganará clics"
  }
]
`;

    const userPrompt = `
Aquí están las 3 oportunidades para el sitio web con nicho/contexto: "${businessNiche}"

Oportunidades a analizar:
${JSON.stringify(opportunities, null, 2)}
`;

    console.log("[API Debug QuickWins] Initializing GoogleGenerativeAI using model: models/gemini-3.5-flash");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-3.5-flash"
    });

    let responseText = "";
    try {
      const originalFetch = global.fetch;
      // @ts-ignore
      global.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        console.log("[API Debug QuickWins] SDK is fetching URL:", input.toString());
        console.log("[API Debug QuickWins] Fetch init options:", JSON.stringify(init || {}));
        return originalFetch(input, init);
      };

      try {
        const result = await model.generateContent(
          {
            contents: [
              { role: 'user', parts: [{ text: systemInstructions + "\n\n" + userPrompt }] }
            ]
          },
          {
            timeout: 30000
          }
        );
        responseText = await result.response.text();
      } finally {
        global.fetch = originalFetch;
      }
    } catch (geminiErr: any) {
      console.warn("[API Debug QuickWins] SDK call failed. Trying direct REST API fallback...", geminiErr.message || geminiErr);
      try {
        responseText = await callGeminiREST(apiKey, systemInstructions + "\n\n" + userPrompt);
        console.log("[API Debug QuickWins] Direct REST API fallback succeeded!");
      } catch (restErr: any) {
        console.error("[API Debug QuickWins] REST fallback failed as well:", restErr.message || restErr);
        throw geminiErr; // Throw original error if fallback also fails
      }
    }

    let parsed: any[] = [];
    try {
      const jsonStart = responseText.indexOf('[');
      const jsonEnd = responseText.lastIndexOf(']');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        parsed = JSON.parse(responseText.substring(jsonStart, jsonEnd + 1));
      } else {
        parsed = JSON.parse(responseText);
      }
    } catch (parseErr: any) {
      console.error("Error parseando JSON de Gemini para Quick Wins:", responseText, parseErr);
      return { success: false, error: "Error al interpretar la respuesta de la IA." };
    }

    // ── POST-PROCESS SAFETY NET ─────────────────────────────────────────────
    // Even if the AI ignored the rule, we correct any Home titles that still
    // contain the raw goldKeyword as the main subject.
    if (cleanGoldKeyword) {
      const domainLabel = (() => { try { return new URL(cleanSiteUrl).hostname.split('.')[0]; } catch { return ''; } })();
      const brandFallbackTitle = businessNiche.split('|')[0].trim() ||
        `${domainLabel ? domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1) + ' | ' : ''}Tienda Online`;

      parsed = parsed.map((win: any) => {
        if (!isHomePage(win.page, cleanSiteUrl)) return win; // Only apply to Home
        const titleLower = (win.suggestedTitle || '').toLowerCase();
        const kwLower = cleanGoldKeyword.toLowerCase();
        // If the suggested title STARTS with the raw keyword or is clearly product-focused
        const isProductTitle = titleLower.startsWith(kwLower) ||
          (titleLower.includes(kwLower) && titleLower.indexOf(kwLower) < 15);
        if (isProductTitle) {
          console.warn(`[QuickWins Safety] Correcting Home title — was: "${win.suggestedTitle}". AI violated Home rule.`);
          win.suggestedTitle = brandFallbackTitle;
          win.explanation = `(Corrección automática) ${win.explanation}`;
        }
        return win;
      });
    }
    // ───────────────────────────────────────────────────────────────────────

    return { success: true, quickWins: parsed, isMockData };
  } catch (error: any) {
    console.error("Error en getQuickWins:", error);
    // Build user-friendly error message
    const errMsg = String(error.message || error).toLowerCase();
    let userMessage = "";
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
      userMessage = "La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo.";
    } else if (errMsg.includes("404") || errMsg.includes("not found")) {
      userMessage = "El modelo de IA no está disponible temporalmente. Intentá de nuevo en unos minutos.";
    } else {
      userMessage = "Error temporal al conectar con la IA. Intentá de nuevo en unos segundos.";
    }
    return {
      success: false,
      error: userMessage,
      stack: error.stack
    };
  }
}

export async function verifyQuickWin(pageUrl: string, suggestedTitle: string) {
  if (!pageUrl || !suggestedTitle?.trim()) {
    return { success: false, message: 'Faltan datos para verificar.' };
  }

  let html: string;
  try {
    console.log(`[verifyQuickWin] Fetching page (no-cache): ${pageUrl}`);
    const finalUrl = pageUrl.includes('?') ? `${pageUrl}&nocache=${Date.now()}` : `${pageUrl}?nocache=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      // @ts-ignore
      next: { revalidate: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `No pude acceder a la página (Error ${response.status}). Verificá que la URL sea pública.`,
      };
    }
    html = await response.text();
  } catch (err: any) {
    return { success: false, message: `Error al acceder a la página: ${err?.message}` };
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch) {
    return { success: false, message: 'No encontramos ninguna etiqueta <title> en tu página. ¡Eso es un problema SEO!' };
  }

  const liveTitle = titleMatch[1].replace(/<[^>]+>/g, '').trim();
  const decodedLiveTitle = decodeHtmlEntities(liveTitle);

  const normLive = normalize(decodedLiveTitle);
  const normSuggested = normalize(suggestedTitle);

  const isMatch = normLive === normSuggested || normLive.includes(normSuggested) || normSuggested.includes(normLive);

  let isOverlap = false;
  if (!isMatch) {
    const suggestedWords = normSuggested.split(' ').filter(w => w.length > 2);
    if (suggestedWords.length > 0 && suggestedWords.every(w => normLive.includes(w))) {
      isOverlap = true;
    }
  }

  if (isMatch || isOverlap) {
    return {
      success: true,
      liveTitle: decodedLiveTitle,
      message: `¡Contenido ganador detectado! Tu título en vivo ahora dice: "${decodedLiveTitle}". ¡Salto de posición garantizado!`,
    };
  } else {
    return {
      success: false,
      liveTitle: decodedLiveTitle,
      message: `El título actual en tu web es: "${decodedLiveTitle}". ¿Ya aplicaste el cambio y borraste la caché?`,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTIVE DE ENLACES — Phase 4: Link Auditing
// ═══════════════════════════════════════════════════════════════════════════

const GENERIC_ANCHOR_PATTERNS = [
  /^click\s?aqu[ií]$/i, /^hac[eé]\s?clic$/i, /^clic\s?aqu[ií]$/i,
  /^ver\s?m[aá]s$/i, /^leer\s?m[aá]s$/i, /^ac[aá]$/i, /^aqu[ií]$/i,
  /^click\s?here$/i, /^read\s?more$/i, /^learn\s?more$/i,
  /^more$/i, /^m[aá]s$/i, /^ir$/i, /^link$/i, /^enlace$/i,
];

function isGenericAnchor(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 3) return true;
  if (clean === "") return true;
  return GENERIC_ANCHOR_PATTERNS.some(p => p.test(clean));
}

function extractLinksFromHtml(html: string, baseUrl: string): Array<{ href: string; anchorText: string; isInternal: boolean }> {
  const links: Array<{ href: string; anchorText: string; isInternal: boolean }> = [];
  const regex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');

  while ((match = regex.exec(html)) !== null) {
    try {
      const rawHref = match[1].trim();
      if (rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("javascript:")) continue;

      const resolved = new URL(rawHref, baseUrl).href;
      const anchorText = match[2].replace(/<[^>]+>/g, '').trim();
      const linkHost = new URL(resolved).hostname.replace(/^www\./, '');
      const isInternal = linkHost === baseHost;

      links.push({ href: resolved, anchorText, isInternal });
    } catch (e) {
      // skip malformed URLs
    }
  }
  return links;
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : "";
}

async function fetchPage(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  try {
    const finalUrl = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
    const response = await fetch(finalUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { html: '', ok: false, status: response.status };
    const html = await response.text();
    return { html, ok: true, status: response.status };
  } catch (e) {
    return { html: '', ok: false, status: 0 };
  }
}

async function checkLinkStatus(url: string): Promise<number> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOJUMP-Bot/1.0)' },
      signal: AbortSignal.timeout(4000),
      redirect: 'follow',
    });
    return response.status;
  } catch (e) {
    return 0;
  }
}

async function crawlSiteLinks(siteUrl: string) {
  const cleanUrl = siteUrl.replace(/\/$/, '');
  const visited = new Set<string>();
  const pages: Array<{ url: string; title: string; links: Array<{ href: string; anchorText: string; isInternal: boolean; statusCode: number }> }> = [];
  const queue: Array<{ url: string; depth: number }> = [{ url: cleanUrl, depth: 0 }];
  const allDestinations = new Map<string, number>(); // url -> status code (lazy check)
  const MAX_PAGES = 10;
  const MAX_DEPTH = 2;

  // BFS crawl
  while (queue.length > 0 && pages.length < MAX_PAGES) {
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
  const destinationUrls = Array.from(allDestinations.keys());
  const BATCH_SIZE = 5;
  for (let i = 0; i < destinationUrls.length; i += BATCH_SIZE) {
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

export async function auditSiteLinks(siteUrl: string, goldKeyword?: string) {
  const urlSanit = sanitizeInput(siteUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  const cleanSiteUrl = urlSanit.sanitized;

  try {
    // 1. Crawl
    const crawlData = await crawlSiteLinks(cleanSiteUrl);

    const stats = {
      totalPages: crawlData.pages.length,
      totalLinks: crawlData.pages.reduce((sum, p) => sum + p.links.length, 0),
      brokenCount: crawlData.brokenLinks.length,
      genericAnchors: crawlData.genericAnchors.length,
      orphanPages: crawlData.orphanPages.length,
    };

    // 2. If no issues found at all, return clean result
    if (stats.brokenCount === 0 && stats.genericAnchors === 0 && stats.orphanPages === 0) {
      return {
        success: true,
        audit: { internalLinking: [], brokenLinks: [], anchorText: [] },
        stats,
      };
    }

    // 3. Build prompt for Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { success: false, error: "GEMINI_API_KEY no configurada." };
    }

    const pagesSummary = crawlData.pages.map(p => `- ${p.url} (título: "${p.title}", ${p.links.length} enlaces)`).join('\n');
    const brokenSummary = crawlData.brokenLinks.slice(0, 10).map(b =>
      `- En "${b.page}" → enlace roto: "${b.href}" (texto: "${b.anchorText}", error: ${b.statusCode})`
    ).join('\n');
    const genericSummary = crawlData.genericAnchors.slice(0, 10).map(g =>
      `- En "${g.page}" → enlace a "${g.href}" con texto genérico: "${g.anchorText}"`
    ).join('\n');
    const orphanSummary = crawlData.orphanPages.slice(0, 5).map(o => `- ${o}`).join('\n');

    const promptText = `
Actuás como un Consultor de Ventas y Estratega Digital entusiasmado que acaba de descubrir oportunidades enormes de mejora en el sitio web de un cliente. Tu tono es profesional pero entusiasmado, como un socio que encontró dinero sobre la mesa.

${goldKeyword ? `El negocio está enfocado en la palabra clave: "${goldKeyword}". Todas las sugerencias deben alinearse con este tema.` : ''}

Analizá estos datos del sitio web "${cleanSiteUrl}":

PÁGINAS ESCANEADAS:
${pagesSummary}

${brokenSummary ? `ENLACES ROTOS (fugas de clientes):
${brokenSummary}` : ''}

${genericSummary ? `TEXTOS DE ENLACE GENÉRICOS (oportunidades desperdiciadas):
${genericSummary}` : ''}

${orphanSummary ? `PÁGINAS PERDIDAS (sin conexión con el resto del sitio):
${orphanSummary}` : ''}

Tu misión es generar recomendaciones accionables en 3 categorías. Devolvé ESTRICTAMENTE un JSON sin bloques markdown:

{
  "internalLinking": [
    {
      "fromPage": "URL de la página fuerte que debe agregar el enlace",
      "toPage": "URL de la página débil/perdida que necesita recibir el enlace",
      "suggestedAnchor": "Texto sugerido para el enlace (con palabras clave naturales, max 6 palabras)",
      "reason": "Explicación entusiasta de por qué este puente de tráfico va a traer más ventas (2-3 oraciones, sin tecnicismos)"
    }
  ],
  "brokenLinks": [
    {
      "page": "URL donde está el enlace roto",
      "brokenUrl": "URL del enlace roto",
      "anchorText": "Texto actual del enlace",
      "statusCode": número,
      "suggestion": "Explicación clara de qué hacer: eliminar el enlace, cambiarlo por otro, o corregir la URL (2-3 oraciones comerciales)"
    }
  ],
  "anchorText": [
    {
      "page": "URL de la página donde está el texto genérico",
      "currentAnchor": "Texto actual del enlace (ej: 'hacé clic acá')",
      "linkTo": "URL a la que apunta el enlace",
      "suggestedAnchor": "Nuevo texto sugerido con palabras clave naturales (max 6 palabras)",
      "reason": "Explicación de por qué este cambio va a atraer más clics y confianza (2-3 oraciones)"
    }
  ]
}

REGLAS ESTRICTAS:
- NUNCA uses palabras técnicas como "canibalización", "backlinks", "DA", "PA", "search intent", "enlazado interno", "thin content", "anchor text"
- Usá expresiones comerciales: "puente de tráfico", "conexión entre páginas", "traspaso de fuerza", "fuga de clientes", "página perdida", "empujar al Top"
- Máximo 5 recomendaciones por categoría
- Si una categoría no tiene problemas, devolvé un array vacío []
- El JSON debe ser válido, sin comentarios ni texto extra
`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error("Gemini API error in auditSiteLinks:", errData);
      if (response.status === 429) {
        return { success: false, error: "La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo." };
      }
      return { success: false, error: "Error temporal al conectar con la IA. Intentá de nuevo." };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Try to find JSON in the text
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch (e2) {
          console.error("Failed to parse Gemini response for audit:", rawText.substring(0, 500));
          return { success: false, error: "Error al interpretar la respuesta de la IA. Intentá de nuevo." };
        }
      } else {
        return { success: false, error: "Error al interpretar la respuesta de la IA. Intentá de nuevo." };
      }
    }

    return {
      success: true,
      audit: {
        internalLinking: Array.isArray(parsed.internalLinking) ? parsed.internalLinking.slice(0, 5) : [],
        brokenLinks: Array.isArray(parsed.brokenLinks) ? parsed.brokenLinks.slice(0, 5) : [],
        anchorText: Array.isArray(parsed.anchorText) ? parsed.anchorText.slice(0, 5) : [],
      },
      stats,
    };

  } catch (error: any) {
    console.error("Error en auditSiteLinks:", error);
    const errMsg = String(error.message || error).toLowerCase();
    let userMessage = "";
    if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate")) {
      userMessage = "La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo.";
    } else {
      userMessage = "Error al escanear el sitio. Verificá que la URL sea correcta e intentá de nuevo.";
    }
    return { success: false, error: userMessage };
  }
}
