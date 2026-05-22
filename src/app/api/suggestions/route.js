import { NextResponse } from 'next/server';

// ── Lista negra global ────────────────────────────────────────────────────────
// Sugerencias que contengan alguna de estas palabras serán descartadas.
const BLACKLIST = [
  'tabla periodica',
  'ferroso',
  'quimica',
  'secundaria',
  'escolar',
  'significado',
  'definicion',
  'monografia',
];

/**
 * Devuelve true si la sugerencia contiene alguna palabra de la lista negra global.
 */
function isBlacklisted(suggestion) {
  const lower = suggestion.toLowerCase();
  return BLACKLIST.some((word) => lower.includes(word));
}

/**
 * Devuelve true si la sugerencia contiene alguna de las palabras excluidas por el usuario.
 * @param {string} suggestion
 * @param {string[]} excludedWords - Array de palabras/frases a excluir (case-insensitive)
 */
function isExcluded(suggestion, excludedWords) {
  if (!excludedWords || excludedWords.length === 0) return false;
  const lower = suggestion.toLowerCase();
  return excludedWords.some((word) => word && lower.includes(word.trim().toLowerCase()));
}

/**
 * COINCIDENCIA ESTRICTA: devuelve true si la sugerencia contiene la query original.
 * Evita alucinaciones como "ferrari" cuando el usuario buscó "ferrico".
 * @param {string} suggestion
 * @param {string} query - La query original del usuario
 */
function containsQuery(suggestion, query) {
  if (!query) return true;
  return suggestion.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Clasifica la intención de búsqueda de una keyword usando heurísticas léxicas.
 * 'atraccion' = búsqueda informativa/educativa | 'venta' = transaccional/comercial
 * @param {string} text
 * @returns {'venta'|'atraccion'}
 */
function classifyIntent(text) {
  const lower = text.toLowerCase();
  const attractionSignals = [
    'como ', 'cómo ', 'qué es', 'que es', 'para qué', 'para que',
    'guia', 'guía', 'tutorial', 'cuando', 'cuándo', 'dónde', 'donde',
    'cuanto', 'cuánto', 'diferencia', 'tipos de', 'beneficios',
    'ventajas', 'desventajas', 'historia de', 'significado', 'aprende',
    'explicacion', 'explicación', 'consejos', 'trucos', 'pasos para',
  ];
  if (attractionSignals.some((kw) => lower.includes(kw))) return 'atraccion';
  return 'venta';
}

/**
 * Intenta extraer el nicho/rubro del sitio a partir de su URL y del nombre del dominio.
 * Devuelve una string de contexto para enriquecer la query (ej: "detailing vehicular")
 * o una string vacía si no puede inferir nada útil.
 */
function inferNichoFromUrl(siteUrl) {
  if (!siteUrl) return '';
  try {
    // Normalizar la URL
    const raw = siteUrl.trim().toLowerCase();
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    const parsed = new URL(url);
    // Tomar el hostname completo: "www.55detailshop.com.ar" → "55detailshop"
    const hostname = parsed.hostname.replace(/^www\./, '');
    const domainSlug = hostname.split('.')[0]; // "55detailshop"

    // Mapa de palabras clave del slug de dominio → término de nicho para enriquecer la query
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
 * Llama a la API de Gemini para generar keywords con intención clasificada.
 * Devuelve un array de objetos { text: string, intent: 'venta'|'atraccion' }.
 */
async function fetchGeminiFallback(query, siteUrl, needed, excludedWords = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'TU_GEMINI_API_KEY_AQUI') {
    console.warn('[suggestions] GEMINI_API_KEY no configurada — fallback IA omitido.');
    return [];
  }

  const exclusionClause = excludedWords.length > 0
    ? ` NUNCA incluyas estas marcas o palabras en tus sugerencias: ${excludedWords.join(', ')}.`
    : '';

  const prompt =
    `El usuario busca palabras clave para "${query}" y su web es "${siteUrl || 'no especificada'}". ` +
    `Generá ${needed} variantes de palabras clave que correspondan estrictamente a su nicho. ` +
    `REGLA OBLIGATORIA 1: cada palabra clave DEBE contener la palabra exacta "${query}".` +
    exclusionClause +
    ` REGLA OBLIGATORIA 2: Clasificá cada keyword en exactamente una de estas dos categorías: ` +
    `"venta" (intención transaccional o comercial, el usuario quiere comprar o contratar) ` +
    `o "atraccion" (intención informativa o educativa, el usuario quiere aprender o resolver una duda). ` +
    ` Devolvé ÚNICAMENTE un array JSON con este formato exacto, sin explicaciones ni markdown: ` +
    `[{"text": "la keyword aquí", "intent": "venta"}, {"text": "otra keyword", "intent": "atraccion"}]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!res.ok) {
      console.error(`[suggestions] Gemini respondió ${res.status}`);
      return [];
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Extraer el array JSON de la respuesta (puede venir con backticks o sin ellos)
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    // Validar y normalizar cada objeto; si Gemini devuelve strings planos, convertir
    return parsed
      .map((item) => {
        if (typeof item === 'string') return { text: item, intent: classifyIntent(item) };
        if (item && typeof item.text === 'string') {
          return {
            text: item.text,
            intent: item.intent === 'atraccion' ? 'atraccion' : 'venta',
          };
        }
        return null;
      })
      .filter(Boolean);
  } catch (err) {
    console.error('[suggestions] Error en fallback Gemini:', err);
    return [];
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const siteUrl = searchParams.get('siteUrl') || '';
  // Filtro Dinámico: palabras/marcas que el usuario quiere excluir
  const excludedWordsRaw = searchParams.get('excludedWords') || '';
  const excludedWords = excludedWordsRaw
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean);

  if (!q) {
    return NextResponse.json({ error: 'Falta la palabra clave (q)' }, { status: 400 });
  }

  // ── Inyector de contexto automático ──────────────────────────────────────
  // Deriva el nicho del sitio y enriquece la query para que Google Autocomplete
  // devuelva sugerencias del rubro correcto en lugar de definiciones genéricas.
  const nicho = inferNichoFromUrl(siteUrl);
  const enrichedQuery = nicho ? `${q} ${nicho}` : q;

  console.log(`[suggestions] query="${q}" siteUrl="${siteUrl}" nicho="${nicho || 'no detectado'}" → enriched="${enrichedQuery}"`);

  // googleSuggestions: string[] — pipeline de filtros opera sobre strings
  let googleSuggestions = [];
  // aiAccepted: { text: string, intent: string }[] — ya vienen clasificados por Gemini
  let aiAccepted = [];

  try {
    // ── 1. Llamada a Google Autocomplete ─────────────────────────────────
    const response = await fetch(
      `https://suggestqueries.google.com/complete/search?client=chrome&hl=es&ie=utf-8&oe=utf-8&q=${encodeURIComponent(enrichedQuery)}`
    );

    if (!response.ok) {
      throw new Error(`Google API respondió con status: ${response.status}`);
    }

    // Read the raw response as ArrayBuffer to handle encoding dynamically
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || '';
    const isIso = contentType.toLowerCase().includes('charset=iso-8859-1');
    const decoder = new TextDecoder(isIso ? 'windows-1252' : 'utf-8');
    const textContent = decoder.decode(buffer);
    const data = JSON.parse(textContent);

    // Google returns an array: ["query", ["sug1", "sug2", ...]]
    // We want the suggestions (index 1) and will take the top 5.
    const rawSuggestions = Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 5) : [];

    // ── 2. Limpiar sufijo de nicho ────────────────────────────────────────
    const nichoStripped = rawSuggestions.map((s) =>
      nicho ? s.replace(new RegExp(`\\s*${nicho}\\s*`, 'gi'), ' ').trim() : s
    );

    // ── 3a. Coincidencia Estricta ─────────────────────────────────────────
    const strictFiltered = nichoStripped.filter((s) => containsQuery(s, q));
    const strictRemoved = nichoStripped.length - strictFiltered.length;
    if (strictRemoved > 0) {
      console.log(`[suggestions] Coincidencia estricta eliminó ${strictRemoved} sugerencia(s) que no contenían "${q}".`);
    }

    // ── 3b. Lista negra global ────────────────────────────────────────────
    const blacklistFiltered = strictFiltered.filter((s) => !isBlacklisted(s));
    const blacklistRemoved = strictFiltered.length - blacklistFiltered.length;
    if (blacklistRemoved > 0) {
      console.log(`[suggestions] Lista negra global eliminó ${blacklistRemoved} sugerencia(s).`);
    }

    // ── 3c. Filtro dinámico del usuario ──────────────────────────────────
    googleSuggestions = blacklistFiltered.filter((s) => !isExcluded(s, excludedWords));
    const dynamicRemoved = blacklistFiltered.length - googleSuggestions.length;
    if (dynamicRemoved > 0) {
      console.log(`[suggestions] Filtro dinámico eliminó ${dynamicRemoved} sugerencia(s):`, excludedWords);
    }
  } catch (error) {
    console.error('[suggestions] Error fetching Google suggestions:', error);
    // No lanzamos — intentamos con el fallback de IA igualmente
  }

  // ── 4. Fallback con IA si hay menos de 3 resultados limpios ──────────────
  const MIN_RESULTS = 3;
  if (googleSuggestions.length < MIN_RESULTS) {
    const needed = MIN_RESULTS - googleSuggestions.length;
    console.log(`[suggestions] Solo ${googleSuggestions.length} resultado(s) de Google. Pidiendo ${needed} a Gemini...`);

    const aiRaw = await fetchGeminiFallback(q, siteUrl, needed, excludedWords);

    // Filtrar sobre .text, descartar duplicados con Google
    aiAccepted = aiRaw
      .filter((s) => containsQuery(s.text, q))            // Coincidencia estricta
      .filter((s) => !isBlacklisted(s.text))              // Lista negra global
      .filter((s) => !isExcluded(s.text, excludedWords))  // Filtro dinámico
      .filter((s) => !googleSuggestions.includes(s.text)) // Sin duplicados con Google
      .slice(0, needed);

    if (aiAccepted.length > 0) {
      console.log(`[suggestions] Gemini aportó ${aiAccepted.length} sugerencia(s) clasificadas:`, aiAccepted);
    }
  }

  // ── 5. Construir respuesta estructurada ───────────────────────────────────
  // Google: clasificación heurística | Gemini: clasificación por IA
  const finalSuggestions = [
    ...googleSuggestions.map((text) => ({ text, intent: classifyIntent(text) })),
    ...aiAccepted,
  ];

  return NextResponse.json({
    suggestions: finalSuggestions,
    nicho: nicho || null,
  });
}
