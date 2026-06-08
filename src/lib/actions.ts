"use server"

import fs from "fs"
import path from "path"
import { signIn, signOut, auth } from "../auth"
import { getSearchConsoleData, submitGoogleIndexing } from "./google"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { completeMission, getMissionsByEmail, deleteProfileByEmail, updateSubscriptionPlan, type MissionType } from './supabase'
import { normalizePagePath, buildAeoKey } from './missionMemory'
import {
  checkAndConsumeAiCredit,
  getAiCreditsStatus,
  getUserPlanSnapshot,
  getCachedGeminiResponse,
  setCachedGeminiResponse,
  buildGeminiCacheKey,
  type AiCreditsStatus,
} from './aiCredits'
import type { AiFeature } from './planLimits'
import { decodeHtmlEntities } from './textUtils'

export async function login() {
  await signIn("google")
}

export async function logout() {
  await signOut()
}

/**
 * Comprueba si el usuario logueado es administrador.
 * Lee ADMIN_EMAILS (o ALLOWED_EMAILS como fallback) en el servidor en tiempo de request,
 * sin depender de variables NEXT_PUBLIC_ que se embeben en build-time.
 * Si la lista está vacía → todos son admin (modo desarrollo abierto).
 */
export async function checkIsAdmin(): Promise<boolean> {
  try {
    const session = await auth();
    const userEmail = (session?.user?.email || '').toLowerCase().trim();
    if (!userEmail) return false;

    // Primero buscar ADMIN_EMAILS, si no existe usar ALLOWED_EMAILS
    const raw = process.env.ADMIN_EMAILS || process.env.ALLOWED_EMAILS || '';
    if (!raw.trim()) return true; // sin lista configurada → todos son admin

    const adminList = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isAdmin = adminList.includes(userEmail);
    console.log(`[checkIsAdmin] ${userEmail} → ${isAdmin} (list: ${adminList.join(', ')})`);
    return isAdmin;
  } catch {
    return false;
  }
}

/**
 * Estado de créditos IA del usuario logueado (para UI).
 */
export async function getAiCreditsStatusForSession(): Promise<AiCreditsStatus | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const isAdmin = await checkIsAdmin();
  return getAiCreditsStatus(email, { isAdmin });
}

/** Plan unificado desde Supabase (paywall, misiones, créditos IA). */
export async function getUserPlanForSession() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  const isAdmin = await checkIsAdmin();
  return getUserPlanSnapshot(email, { isAdmin });
}

/**
 * Activa plan PRO o Agencia manualmente (solo admin). Útil hasta integrar Mercado Pago.
 */
export async function activateUserPlan(
  targetEmail: string,
  plan: 'free' | 'pro' | 'agency',
  months: number = 1
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    return { success: false, error: 'Solo administradores pueden activar planes.' };
  }

  const email = targetEmail.trim().toLowerCase();
  if (!email) return { success: false, error: 'Email inválido.' };

  let expiresAt: string | null = null;
  if (plan !== 'free' && months > 0) {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    expiresAt = d.toISOString();
  }

  const ok = await updateSubscriptionPlan(email, plan, expiresAt);
  if (!ok) {
    return { success: false, error: 'No se pudo actualizar el plan. ¿Ejecutaste la migración 003 en Supabase?' };
  }

  return { success: true };
}

type GeminiCreditResult =
  | { ok: true; text: string; credits: AiCreditsStatus }
  | {
      ok: false;
      error: string;
      code?: string;
      credits?: AiCreditsStatus;
      upgrade?: boolean;
    };

async function invokeGeminiWithCredits(params: {
  email: string;
  isAdmin: boolean;
  feature: AiFeature;
  cacheKey: string;
  prompt: string;
  apiKey: string;
}): Promise<GeminiCreditResult> {
  const cached = await getCachedGeminiResponse(params.cacheKey);
  if (cached) {
    const status = await getAiCreditsStatus(params.email, { isAdmin: params.isAdmin });
    return { ok: true, text: cached, credits: status };
  }

  const creditCheck = await checkAndConsumeAiCredit(params.email, params.feature, {
    isAdmin: params.isAdmin,
  });

  if (creditCheck.allowed === false) {
    return {
      ok: false,
      error: creditCheck.error,
      code: creditCheck.code,
      credits: creditCheck.status,
      upgrade: true,
    };
  }

  const text = await callGeminiREST(params.apiKey, params.prompt);
  await setCachedGeminiResponse(params.cacheKey, text);
  return { ok: true, text, credits: creditCheck.status };
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
    const domainRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z]{2,10})([/\w .-]*)*\/?$/;
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
function geminiKeyHint(apiKey: string): string | null {
  if (apiKey.startsWith('AQ.')) {
    return 'Tu clave empieza con "AQ." y Google aún no la acepta en todos los endpoints. Creá una clave clásica que empiece con "AIza" en Google Cloud Console → APIs y servicios → Credenciales → Crear credenciales → Clave de API.';
  }
  return null;
}

/** Mensaje claro según el tipo de fallo de Gemini (saldo, cuota, clave, etc.). */
function geminiErrorToUserMessage(rawError: string): string {
  const errMsg = String(rawError || '').toLowerCase();

  if (
    errMsg.includes('prepayment credits are depleted') ||
    errMsg.includes('prepayment credit') ||
    errMsg.includes('credits are depleted') ||
    (errMsg.includes('saldo') && errMsg.includes('agot'))
  ) {
    return 'Saldo de Google agotado. El administrador debe cargar créditos en AI Studio (aistudio.google.com) → tu proyecto → Comprar créditos.';
  }

  if (errMsg.includes('api key expired') || errMsg.includes('api_key_invalid') || errMsg.includes('key expired') || errMsg.includes('key invalid') || errMsg.includes('invalid authentication')) {
    return '⚠️ La clave de API de Gemini venció o es inválida. El administrador debe renovarla en Google AI Studio.';
  }

  if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('resource_exhausted')) {
    return 'La IA está procesando muchas consultas. Esperá 30 segundos e intentá de nuevo.';
  }

  if (errMsg.includes('404') || errMsg.includes('not found')) {
    return 'El modelo de IA no está disponible temporalmente. Intentá de nuevo en unos minutos.';
  }

  return 'Error temporal al conectar con la IA. Intentá de nuevo en unos segundos.';
}

async function callGeminiREST(apiKey: string, promptText: string): Promise<string> {
  const model = { name: 'gemini-2.5-flash', api: 'v1beta' };
  const useHeaderAuth = apiKey.startsWith('AQ.');
  const baseUrl = `https://generativelanguage.googleapis.com/${model.api}/models/${model.name}:generateContent`;
  const url = useHeaderAuth ? baseUrl : `${baseUrl}?key=${encodeURIComponent(apiKey)}`;
  let lastError = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    console.log(`[Gemini REST] ${model.name} (attempt ${attempt + 1})...`);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useHeaderAuth) headers['x-goog-api-key'] = apiKey;

      const response = await fetch(url, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
        signal: AbortSignal.timeout(12000),
      });

      if ((response.status === 429 || response.status === 503) && attempt === 0) {
        lastError = `${model.name}: ${response.status}`;
        console.warn(`[Gemini REST] ${response.status}, retry in 2s...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        lastError = `${model.name}: ${response.status} ${errText.substring(0, 200)}`;
        break;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!text) {
        lastError = `${model.name}: empty response`;
        break;
      }
      console.log(`[Gemini REST] ✅ ${model.name} OK`);
      return text;
    } catch (fetchErr: any) {
      lastError = `${model.name}: ${fetchErr.message}`;
      break;
    }
  }

  const keyHint = geminiKeyHint(apiKey);
  if (keyHint && (lastError.includes('401') || lastError.includes('invalid authentication'))) {
    throw new Error(keyHint);
  }
  throw new Error(`Gemini failed. Last error: ${lastError}`);
}


/**
 * Mission type definitions.
 * We rotate through types to give the user variety.
 *
 * pistas structure (bifurcated, fail-safe):
 * {
 *   classic: string[]    — Steps for classic WordPress editor
 *   visual:  string[]    — Steps for Elementor / UX Builder / Divi
 *   cacheWarning: boolean — Whether to show the cache purge reminder
 *   videoUrl?: string    — Future: link to Loom/GIF demo (inject when ready)
 *   gifUrl?:  string     — Future: inline GIF demo
 * }
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
    pistas: {
      classic: [
        `Andá a tu panel de WordPress → Páginas (o Entradas) → hacé clic en Editar en la página que aparece arriba.`,
        `Buscá el título grande que está arriba del contenido (es el H1 por defecto en la mayoría de los temas).`,
        goldKeyword
          ? `Reemplazalo por un texto que incluya «${goldKeyword}» de forma natural. Ejemplo: «${goldKeyword} – [Tu marca]».`
          : `Reemplazalo por un texto claro y descriptivo que le diga a Google de qué trata la página.`,
        `Hacé clic en el botón azul Actualizar (arriba a la derecha) para guardar.`,
      ],
      visual: [
        `Abrí la página con tu constructor visual (Elementor, UX Builder o Divi) → hacé clic en Editar con [tu constructor].`,
        `Hacé clic en el elemento de texto que es el título principal de la página.`,
        `En el panel de la derecha (o en la barra de opciones del elemento), buscá la opción Etiqueta HTML y asegurate de que diga H1.`,
        goldKeyword
          ? `Cambiá el texto por uno que incluya «${goldKeyword}». Luego hacé clic en Aplicar (Apply).`
          : `Cambiá el texto por uno claro y descriptivo. Luego hacé clic en Aplicar (Apply).`,
        `Hacé clic en Guardar / Publicar (botón verde o azul) para que el cambio quede en vivo.`,
      ],
      cacheWarning: true,
      videoUrl: undefined, // TODO: agregar link de Loom cuando esté listo
      gifUrl: undefined,   // TODO: agregar GIF demostrativo cuando esté listo
    },
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
    pistas: {
      classic: [
        `Editá la página desde WordPress → Páginas → Editar.`,
        `Bajá hasta la sección de tu plugin SEO (Yoast SEO, Rank Math o similar). Buscá la caja que dice Meta Descripción o Snippet.`,
        goldKeyword
          ? `Escribí un texto de hasta 160 caracteres que incluya «${goldKeyword}» y un llamado a la acción. Ej: «Encontrá los mejores productos de ${goldKeyword}. Envío a todo el país. ¡Comprá hoy!».`
          : `Escribí un texto de hasta 160 caracteres, atractivo y con un llamado a la acción claro.`,
        `Hacé clic en Actualizar para guardar el cambio.`,
      ],
      visual: [
        `Abrí tu constructor visual y editá la página.`,
        `Buscá la sección de Configuración de la página (generalmente un ícono de engranaje ⚙️ o en el menú del constructor).`,
        `Dentro de esa sección vas a encontrar la pestaña SEO o Meta. Hacé clic en ella.`,
        goldKeyword
          ? `Pegá tu texto de Meta Descripción con «${goldKeyword}» en la caja correspondiente.`
          : `Pegá tu nuevo texto de Meta Descripción en la caja correspondiente.`,
        `Guardá y publicá los cambios.`,
      ],
      cacheWarning: true,
      videoUrl: undefined,
      gifUrl: undefined,
    },
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
    pistas: {
      classic: [
        `Editá la página desde WordPress → Páginas (o Entradas) → Editar.`,
        `Hacé clic en la imagen que querés editar.`,
        `En el menú que aparece a la derecha, buscá la caja que dice Texto Alternativo.`,
        goldKeyword
          ? `Pegá tu palabra clave: ej. «${goldKeyword} siendo aplicado en auto».`
          : `Escribí una descripción breve de lo que muestra la imagen.`,
        `Hacé clic en Actualizar para guardar.`,
      ],
      visual: [
        `Abrí tu constructor visual y editá la página.`,
        `Hacé clic en la imagen (o en el banner de fondo si es una imagen de fondo).`,
        `Buscá el botón Cambiar Medio (Change Media) o el ícono de engranaje ⚙️ del elemento.`,
        `Una vez que se abra la biblioteca de fotos, pegá el texto en la caja Texto Alternativo que aparece a la derecha.`,
        goldKeyword
          ? `Escribí algo como: «${goldKeyword} siendo aplicado en auto rojo».`
          : `Escribí una descripción breve de lo que muestra la imagen.`,
        `Hacé clic en Aplicar (Apply) y luego Guardar / Publicar.`,
      ],
      cacheWarning: true,
      videoUrl: undefined,
      gifUrl: undefined,
    },
  },
  // ── MISIÓN AEO: Optimización para IA ─────────────────────────────────────
  // Se activa cuando la búsqueda de GSC es una pregunta (cómo, qué, cuál, etc.)
  // Pide agregar una sección FAQ que multiplica chances de aparecer en AI Overviews
  {
    type: 'AEO',
    title: 'Que ChatGPT y Google IA te recomienden',
    descriptionTemplate: (path: string) =>
      goldKeyword
        ? `La página ${path} aparece para «${goldKeyword}» — una pregunta real. Agregá al final un bloque de preguntas y respuestas (ej: «¿Para qué sirve?» + respuesta corta) para que ChatGPT y Google IA puedan citar tu página.`
        : `La página ${path} aparece para búsquedas con preguntas. Agregá al final un bloque de preguntas y respuestas con dudas reales de tus clientes y respuestas cortas.`,
    xp: 80,
    icon: '🤖',
    color: 'purple',
    pistas: {
      classic: [
        `Editá la página desde WordPress → Páginas (o Productos/Entradas) → Editar.`,
        `Bajá al final del contenido de la página.`,
        goldKeyword
          ? `Agreá un bloque de texto nuevo con el título H2: «Preguntas frecuentes sobre ${goldKeyword}».`
          : `Agreá un bloque de texto nuevo con el título H2: «Preguntas frecuentes».`,
        `Abajo del H2, escribí al menos 3 preguntas reales que hace tu cliente. Respondélas en 2-3 oraciones cada una. Ej: «¿Para qué sirve?», «¿Cómo se usa?», «¿Cuál es la diferencia entre X e Y?».`,
        `Hacé clic en Actualizar para guardar. Google y la IA pueden tardar unos días en procesar el nuevo contenido.`,
      ],
      visual: [
        `Abrí tu constructor visual (Elementor, Divi, UX Builder) y editá la página.`,
        `Bajá al final del contenido. Agregá un bloque de texto normal (o «Preguntas frecuentes» si tu tema tiene ese bloque).`,
        goldKeyword
          ? `Creá un H2 que diga «Preguntas frecuentes sobre ${goldKeyword}».`
          : `Creá un H2 que diga «Preguntas frecuentes».`,
        `Agreá 3 o más preguntas con sus respuestas. Escribí de forma natural, como si le hablaras directamente a tu cliente.`,
        `Guardá y publicá los cambios.`,
      ],
      cacheWarning: false,
      videoUrl: undefined,
      gifUrl: undefined,
    },
  },
]


// ── Detecta si una búsqueda es una pregunta (trigger para misiones AEO) ──────
// Las preguntas indican que el usuario busca una respuesta concreta —
// exactamente el tipo de contenido que las IAs (ChatGPT, Gemini, AI Overviews)
// prefieren citar. Agregar FAQ convierte la página en fuente ideal para la IA.
function isQuestionQuery(keyword: string): boolean {
  if (!keyword) return false;
  const kw = keyword.toLowerCase().trim();
  const questionPatterns = [
    // Español — inicio de pregunta
    'qué ', 'que ', 'cómo ', 'como ', 'cuál ', 'cual ', 'cuándo ', 'cuando ',
    'dónde ', 'donde ', 'por qué', 'para qué', 'cuánto', 'cuánta',
    // Frases dentro de la búsqueda (no solo al inicio)
    ' sirve', ' es bueno', ' es mejor', ' diferencia', ' funciona',
    ' se usa', ' se puede', ' conviene', ' recomendable', ' para qué',
    // Inglés
    'how ', 'what ', 'why ', 'when ', 'where ', 'which ', 'is it', 'can i',
    'does it', 'should i',
  ];
  return questionPatterns.some(p => kw.startsWith(p.trimStart()) || kw.includes(p));
}
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// MOTOR DE SELECCIÓN INTELIGENTE DE KEYWORDS (genérico, multi-rubro)
// Replica el criterio de un consultor SEO: no optimizar lo que ya ganás, sino
// atacar la KEYWORD DE INTENCIÓN — alta demanda + posición alcanzable.
// ═══════════════════════════════════════════════════════════════════════════

/** Limpia la keyword cruda de GSC (saca $ y símbolos iniciales). */
function cleanGscKeyword(raw: string): string {
  return (raw || '')
    .replace(/\$/g, '')
    .replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '')
    .trim();
}

/**
 * Peso por "zona de ataque" (striking distance). Un SEO prioriza posiciones
 * 4-20: ya están en el radar de Google y un empujón las sube al Top 3.
 * Posición 1-3 ya se ganó (poco para mejorar); >40 está demasiado lejos.
 */
function positionOpportunityWeight(position: number): number {
  if (!position || position <= 0) return 0.5;
  if (position <= 3) return 0.18;
  if (position <= 10) return 1.0;
  if (position <= 20) return 0.85;
  if (position <= 40) return 0.4;
  return 0.12;
}

/**
 * Puntaje de oportunidad de una búsqueda. Combina DEMANDA (impresiones, en
 * escala logarítmica para no sesgar hacia un único término gigante) con cuán
 * ALCANZABLE es la posición actual. Es lo que hace que el sistema elija la
 * keyword de intención en lugar de la de marca que ya rankeás. Sirve para
 * cualquier rubro porque se basa en datos, no en nichos hardcodeados.
 */
function opportunityScore(row: { impressions?: number; position?: number }): number {
  const impressions = row.impressions || 0;
  const position = row.position || 100;
  return Math.log10(impressions + 1) * 10 * positionOpportunityWeight(position);
}

/** Tokens de la marca del sitio (para no perseguir tu propia marca). */
function deriveBrandTokens(siteUrl: string): string[] {
  try {
    const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const host = new URL(url).hostname.replace(/^www\./, '');
    const slug = host.split('.')[0];
    const tokens = new Set<string>();
    tokens.add(slug);
    slug.split(/[-_]/).forEach(t => t && tokens.add(t));
    return Array.from(tokens).filter(t => t.length >= 3);
  } catch {
    return [];
  }
}

/** ¿La búsqueda es básicamente solo la marca del sitio (sin término de intención)? */
function isMostlySiteBrand(query: string, brandTokens: string[]): boolean {
  if (!brandTokens.length || !query) return false;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const nonBrand = words.filter(w => !brandTokens.some(bt => w.includes(bt) || bt.includes(w)));
  return nonBrand.length === 0;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function getRealMissions(siteUrl: string, goldKeyword?: string, goal?: string) {
  // Sanitizar entradas
  const urlSanit = sanitizeInput(siteUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  const cleanSiteUrl = urlSanit.sanitized;
  const cleanGoal = (goal || '').trim().toLowerCase();

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

    const rowLimit = cleanGoldKeyword ? 25 : 50;
    let rows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanGoldKeyword || undefined, rowLimit)

    if (!rows || rows.length === 0) {
      return { success: true, data: [] }
    }

    const sortGscRows = (list: typeof rows) =>
      [...list].sort((a, b) => {
        const clicksDiff = (b.clicks || 0) - (a.clicks || 0);
        if (clicksDiff !== 0) return clicksDiff;
        return (b.impressions || 0) - (a.impressions || 0);
      });

    // Sort by clicks desc, then impressions desc
    let sortedRows = sortGscRows(rows);

    // ── Excluir la página de inicio de las misiones regulares ─────────────
    // La portada representa la marca/categoría del negocio, no un producto
    // específico. Pedirle al usuario que ponga "limpia llantas" en el H1
    // de su home es un error SEO. La home se optimiza por Quick Wins
    // con keywords institucionales (ej: "tienda de car detailing").
    const isHomeUrl = (url: string): boolean => {
      try {
        const page = new URL(url);
        const site = new URL(
          cleanSiteUrl.startsWith('http') ? cleanSiteUrl : `https://${cleanSiteUrl}`
        );
        return (
          page.hostname === site.hostname &&
          (page.pathname === '/' || page.pathname === '')
        );
      } catch {
        return false;
      }
    };

    let missionRows = sortedRows.filter(row => !isHomeUrl(row.keys[0]));

    // Si el top de GSC es solo la home, ampliar búsqueda sin filtro de keyword
    if (missionRows.length === 0) {
      const broaderRows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, undefined, 100);
      if (broaderRows?.length) {
        sortedRows = sortGscRows(broaderRows);
        missionRows = sortedRows.filter(row => !isHomeUrl(row.keys[0]));
        console.log(`[getRealMissions] Fallback sin keyword: ${missionRows.length} página(s) fuera de home`);
      }
    }

    // ── Coherencia semántica: keyword vs. URL de la página ────────────────
    // GSC a veces registra búsquedas de productos en páginas de categorías
    // que no corresponden. Si el keyword no tiene ninguna palabra en común
    // con la URL de la página, derivamos un keyword desde la URL misma.
    // Ej: "limpia llantas" en ".../accesorios-varios/" → usa "accesorios varios"
    const resolveKeyword = (gscKeyword: string, pageUrl: string, fallback: string): string => {
      if (!gscKeyword) return fallback || '';
      try {
        const path = new URL(pageUrl).pathname.toLowerCase();
        // Words from the keyword with 5+ characters (skip short stop words)
        const kwWords = gscKeyword.toLowerCase().split(/\s+/).filter(w => w.length >= 5);
        // If any keyword word (first 5 chars) appears in the path → good match
        const fits = kwWords.length === 0 ||
          kwWords.some(w => path.includes(w.slice(0, 5)));
        if (fits) return gscKeyword;
        // Poor match: derive a readable keyword from the URL slug
        const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || '';
        const urlKeyword = lastSegment.replace(/-/g, ' ').trim();
        console.log(`[resolveKeyword] Keyword «${gscKeyword}» no encaja en ${path} → usando «${urlKeyword || gscKeyword}»`);
        return urlKeyword || gscKeyword;
      } catch {
        return gscKeyword;
      }
    };
    // ─────────────────────────────────────────────────────────────────────

    // Páginas ya optimizadas — no volver a pedir tareas en la misma URL
    const completedPagePaths = new Set<string>();
    if (session?.user?.email) {
      try {
        const doneMissions = await getMissionsByEmail(session.user.email, 'completed');
        for (const m of doneMissions) {
          if (['H1', 'META', 'ALT', 'AEO'].includes(m.mission_type)) {
            completedPagePaths.add(normalizePagePath(m.target_url));
          }
        }
      } catch (err) {
        console.warn('[getRealMissions] No se pudieron cargar misiones completadas:', err);
      }
    }

    const brandTokens = deriveBrandTokens(cleanSiteUrl);

    // ── Agrupar TODAS las búsquedas de cada página ──
    // En vez de quedarnos con la query de más clics (la que ya ganás), juntamos
    // todas las búsquedas por las que aparece cada página para luego elegir la
    // de mayor OPORTUNIDAD real.
    const rowsByPage = new Map<string, typeof missionRows>();
    for (const row of missionRows) {
      const pagePath = normalizePagePath(row.keys[0]);
      if (completedPagePaths.has(pagePath)) continue;
      const list = rowsByPage.get(pagePath) || [];
      list.push(row);
      rowsByPage.set(pagePath, list);
    }

    const missions: any[] = [];

    for (const [pagePath, pageRows] of rowsByPage) {
      // 1. Puntuar cada búsqueda por oportunidad (demanda × posición alcanzable).
      //    Despriorizar las que son solo tu marca (ya las ganás).
      const candidates = pageRows
        .map(r => {
          const kw = cleanGscKeyword(r.keys[1] || '');
          let score = opportunityScore(r);
          if (isMostlySiteBrand(kw, brandTokens)) score *= 0.25;
          return { row: r, kw, score, isQuestion: isQuestionQuery(kw) };
        })
        .filter(c => c.kw.length > 0);

      // 2. Separar intención COMERCIAL (SEO) vs PREGUNTAS (AEO/GEO — que la IA cite).
      const commercial = candidates.filter(c => !c.isQuestion).sort((a, b) => b.score - a.score);
      const questions  = candidates.filter(c => c.isQuestion).sort((a, b) => b.score - a.score);
      const bestCommercial = commercial[0];
      const bestQuestion   = questions[0];

      // 3. Elegir la misión más inteligente para esta página:
      //    - Si la mayor oportunidad es una pregunta con demanda → AEO/GEO.
      //    - Si no → H1 atacando la keyword de INTENCIÓN comercial.
      //    El objetivo del dueño inclina suavemente la balanza (sin romper el motor):
      //    "visitas" favorece preguntas (AEO/alcance); "vender" favorece la intención comercial (H1).
      const questionBias = cleanGoal === 'visitas' ? 1.3 : cleanGoal === 'vender' ? 0.77 : 1;
      const questionScoreAdj = bestQuestion ? bestQuestion.score * questionBias : 0;
      let chosen: { row: typeof pageRows[0]; kw: string; score: number };
      let missionType: 'H1' | 'AEO';
      if (bestQuestion && (!bestCommercial || questionScoreAdj >= bestCommercial.score)) {
        chosen = bestQuestion;
        missionType = 'AEO';
      } else if (bestCommercial) {
        chosen = bestCommercial;
        missionType = 'H1';
      } else {
        chosen = { row: pageRows[0], kw: '', score: 0 };
        missionType = 'H1';
      }

      const fullPageUrl = chosen.row.keys[0];
      // Para AEO conservamos la pregunta tal cual; para SEO ajustamos a la URL.
      const effectiveKeyword = missionType === 'AEO'
        ? chosen.kw
        : resolveKeyword(chosen.kw, fullPageUrl, cleanGoldKeyword);

      let displayPath = pagePath;
      if (displayPath === '/') {
        displayPath = 'Página de Inicio (Portada)';
      } else {
        displayPath = displayPath.replace(/^\/+|\/+$/g, '').replace(/[-/]/g, ' ');
        if (displayPath.length > 0) {
          displayPath = displayPath.charAt(0).toUpperCase() + displayPath.slice(1);
        }
        if (displayPath.length > 40) {
          displayPath = displayPath.slice(0, 37) + '...';
        }
      }

      const MISSION_TYPES = buildMissionTypes(effectiveKeyword);
      const missionDef = MISSION_TYPES.find(m => m.type === missionType)!;

      missions.push({
        id: `${missionDef.type.toLowerCase()}-${pagePath}`,
        title: missionDef.title,
        description: missionDef.descriptionTemplate(displayPath),
        xp: missionDef.xp,
        page: fullPageUrl,
        pagePath: pagePath,
        type: missionDef.type,
        icon: missionDef.icon,
        color: missionDef.color,
        pistas: missionDef.pistas,
        keyword: effectiveKeyword,
        clicks: chosen.row.clicks,
        impressions: chosen.row.impressions,
        ctr: chosen.row.ctr,
        position: chosen.row.position,
        opportunity: Math.round(chosen.score * 10) / 10,
      });
    }

    // Ordenar por oportunidad: primero las páginas con mayor potencial de salto.
    missions.sort((a, b) => (b.opportunity || 0) - (a.opportunity || 0));

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

  // Keyword gate: verificar que el INPUT del usuario incluya las palabras clave activas.
  // IMPORTANTE: usamos matching por palabras individuales (no cadena completa) para tolerar
  // títulos naturales como "Óxido de cerio puro - Pulidor" cuando la keyword es "oxido cerio".
  // Si el input pasa, bien. Si no, le decimos exactamente qué palabra falta.
  if (goldKeyword?.trim()) {
    const normalizedInput   = normalize(userInput)
    const normalizedKeyword = normalize(goldKeyword)

    // Solo verificar palabras significativas (> 3 chars) para ignorar artículos/preposiciones
    const keywordWords = normalizedKeyword.split(' ').filter(w => w.length > 3)
    const missingWords = keywordWords.filter(w => !normalizedInput.includes(w))

    console.log(`[verifyMission] Keyword gate — words to find: [${keywordWords}], missing: [${missingWords}]`)

    if (keywordWords.length > 0 && missingWords.length > 0) {
      // Si falta MÁS DE LA MITAD de las palabras clave → rechazar.
      // Esto tolera títulos largos donde alguna palabra puede estar en forma ligeramente distinta.
      const missingRatio = missingWords.length / keywordWords.length
      if (missingRatio > 0.5) {
        return {
          success: false,
          message: `Tu ${type} no incluye palabras clave importantes de «${goldKeyword}» (falta: ${missingWords.slice(0, 3).join(', ')}). Incorporalas para que Google entienda de qué trata tu página.`,
        }
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
      
      // 1. El live value coincide con el input del usuario (exacto o contiene/está contenido)
      const matchesInput = normalizedLive === normalizedInput
        || normalizedLive.includes(normalizedInput)
        || normalizedInput.includes(normalizedLive);
      
      // 2. El live value contiene la keyword directamente (sin importar el input del usuario)
      const matchesKeyword = normalizedKeyword
        && (normalizedLive === normalizedKeyword || normalizedLive.includes(normalizedKeyword));

      // 3. ⭐ NUEVO: matching por palabras individuales de la keyword en el live value.
      // Evita falsos negativos cuando el H1 tiene un título natural largo como
      // "Óxido de cerio puro - Pulidor premium para vidrios" y la keyword es "oxido cerio".
      let matchesKeywordWords = false;
      if (normalizedKeyword && !matchesKeyword) {
        const kwWords = normalizedKeyword.split(' ').filter(w => w.length > 3);
        if (kwWords.length > 0) {
          const foundWords = kwWords.filter(w => normalizedLive.includes(w));
          // Pasa si al menos el 50% de las palabras clave significativas están en el H1 vivo
          matchesKeywordWords = foundWords.length / kwWords.length >= 0.5;
          if (matchesKeywordWords) {
            console.log(`[verifyMission] ✅ Keyword-words match on live value: found [${foundWords}] of [${kwWords}]`);
          }
        }
      }
      
      if (matchesInput || matchesKeyword || matchesKeywordWords) {
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

// NOTE: metadataCache was removed — module-level Maps on Vercel serverless
// share state across requests in the same warm Lambda instance, which caused
// desktop users' cached metadata to 'poison' cold-start instances used by
// mobile clients. Each request now scrapes independently.


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
  } catch (error) {
    console.error("Error scraping metadata:", error);
  }
  
  return result;
}

/** Vista previa en vivo de título, meta y H1 para misiones (antes/después). */
export async function getPageLivePreview(pageUrl: string) {
  try {
    const preview = await scrapeMetadata(pageUrl);
    return { success: true, preview };
  } catch (error) {
    console.error("getPageLivePreview:", error);
    return { success: false, preview: { title: "", description: "", h1: "" } };
  }
}

/**
 * Sugerencia de título/meta generada por IA para una misión puntual.
 * Razona como un consultor SEO: preserva las palabras de intención de búsqueda
 * y alta conversión (ej: "parabrisas"), elimina ruido (gramaje/stock), respeta
 * 60 caracteres y nunca deja el título "pelado" (solo marca). Si la IA no puede
 * responder (sin créditos, error, sin clave), devuelve fallback:true para que la
 * UI use la plantilla determinística como red de seguridad.
 */
export async function getSmartMissionSuggestion(params: {
  pageUrl: string;
  missionType: string;
  keyword?: string;
  currentValue?: string;
  siteUrl?: string;
  // Contexto real de la página (del scraper en vivo) — qué vende realmente.
  pageTitle?: string;
  pageH1?: string;
  pageDescription?: string;
  // Métricas de Search Console — cómo le va hoy a esa página.
  position?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  // Contexto declarado por el dueño del negocio.
  goal?: string;   // 'vender' | 'visitas' | 'local'
  brands?: string; // marcas que el negocio realmente vende/distribuye
}) {
  const { pageUrl, missionType } = params;
  const keyword = (params.keyword || '').trim();
  const currentValue = (params.currentValue || '').trim();
  const siteUrl = (params.siteUrl || '').trim();
  const pageTitle = (params.pageTitle || '').trim();
  const pageH1 = (params.pageH1 || '').trim();
  const pageDescription = (params.pageDescription || '').trim();
  const position = typeof params.position === 'number' ? params.position : null;
  const impressions = typeof params.impressions === 'number' ? params.impressions : null;
  const clicks = typeof params.clicks === 'number' ? params.clicks : null;
  const ctr = typeof params.ctr === 'number' ? params.ctr : null;
  const goal = (params.goal || '').trim().toLowerCase();
  const brands = (params.brands || '').trim().slice(0, 300);

  // Solo H1 (título) y META se benefician de la IA aquí.
  if (missionType !== 'H1' && missionType !== 'META') {
    return { success: false, fallback: true as const };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, fallback: true as const };

  let email = '';
  let isAdmin = false;
  try {
    const session = await auth();
    email = session?.user?.email || '';
    isAdmin = await checkIsAdmin();
  } catch {
    return { success: false, fallback: true as const };
  }
  if (!email && !isAdmin) return { success: false, fallback: true as const };

  let brand = siteUrl;
  let isHomepage = false;
  try {
    const u = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    brand = new URL(u).hostname.replace(/^www\./, '');
  } catch { /* keep raw */ }
  try {
    const pu = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`;
    const p = new URL(pu).pathname.replace(/\/+$/, '');
    isHomepage = p === '' || p === '/';
  } catch { /* assume internal */ }

  const isTitle = missionType === 'H1';

  const cacheKey = buildGeminiCacheKey([
    'title_suggestion_v4',
    email || 'anon',
    pageUrl,
    missionType,
    keyword,
    currentValue.slice(0, 120),
    pageH1.slice(0, 60),
    position != null ? String(Math.round(position)) : '',
    goal,
    brands.slice(0, 80),
  ]);

  // Cortocircuito: si ya está cacheado, devolvemos sin escanear la portada ni gastar crédito.
  try {
    const cachedEarly = await getCachedGeminiResponse(cacheKey);
    if (cachedEarly) {
      const raw = cachedEarly.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(raw);
      const cachedTitle = decodeHtmlEntities((parsed.suggestedTitle || '').trim());
      if (cachedTitle) {
        return { success: true as const, suggestedTitle: cachedTitle, reason: (parsed.reason || '').trim(), fromCache: true as const };
      }
    }
  } catch { /* si el cache está corrupto, seguimos y regeneramos */ }

  // Contexto del negocio: leemos la PORTADA para detectar rubro y perfil multimarca.
  // Solo en la primera generación de la misión (después queda todo cacheado 24h).
  let businessContext = '';
  if (!isHomepage && siteUrl) {
    try {
      const homeUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      const home = await scrapeMetadata(homeUrl);
      businessContext = [home.title, home.h1, home.description]
        .filter(Boolean)
        .join(' — ')
        .slice(0, 500);
    } catch { /* sin contexto de portada: la IA decide con el contenido de la página */ }
  }

  // Bloque de contexto que la IA debe relacionar antes de decidir.
  const pageSells = [
    pageTitle && `  • Título actual: "${pageTitle}"`,
    pageH1 && `  • Encabezado H1: "${pageH1}"`,
    pageDescription && `  • Descripción: "${pageDescription}"`,
  ].filter(Boolean).join('\n') || '  • (sin datos de contenido — inferí con cautela desde la URL)';

  const metricsBlock = [
    position != null && `  • Posición actual en Google: ${position.toFixed(1)} ${position <= 10 ? '(página 1 — está MUY cerca, no la rompas: optimizá con cuidado)' : position <= 20 ? '(página 2 — zona de ataque: vale la pena ser más agresivo para subirla)' : '(lejos — necesita un cambio fuerte y claro)'}`,
    impressions != null && `  • Impresiones: ${impressions} (gente que ya la ve en Google)`,
    clicks != null && `  • Clics: ${clicks}`,
    ctr != null && `  • CTR: ${(ctr * 100).toFixed(1)}%`,
  ].filter(Boolean).join('\n') || '  • (sin métricas de Search Console)';

  // Objetivo declarado por el dueño — inclina la estrategia del título/meta.
  const goalGuidance =
    goal === 'vender'
      ? 'VENDER MÁS: priorizá la intención de COMPRA. Resaltá el producto/servicio concreto y, si entra, señales transaccionales sutiles (sin inventar precios ni promos). El objetivo es atraer a quien está listo para comprar.'
      : goal === 'visitas'
      ? 'CONSEGUIR MÁS VISITAS: priorizá el alcance y el atractivo del clic. Usá el término más buscado del rubro y un texto que invite a entrar, aunque sea más informativo que netamente comercial.'
      : goal === 'local'
      ? 'SER EL #1 EN LA CIUDAD (SEO local): si el negocio tiene zona/ciudad detectable en su contenido, incorporá la localidad de forma natural (ej: "en [Ciudad]" o "envíos a [zona]") para captar búsquedas locales. NUNCA inventes una ciudad: solo usala si aparece en el contenido del negocio.'
      : '';

  const brandsBlock = brands
    ? `\nMARCAS QUE EL DUEÑO DECLARÓ QUE VENDE/DISTRIBUYE (fuente confiable, priorizá estas):\n  ${brands}\n  → Esto confirma que el negocio es MULTIMARCA. Podés usar estas marcas con total libertad en el título/meta si son relevantes para esta página.`
    : '';

  const prompt = `
Actuás como un consultor SEO experto que optimiza una página para un dueño de negocio NO técnico que va a confiar a ciegas en tu recomendación. Tu respuesta tiene que ser segura, lista para copiar y pegar. Tenés que RELACIONAR TODAS las variables de abajo antes de decidir, como haría un consultor humano real.

NEGOCIO Y PÁGINA:
- Sitio/marca: ${brand}
- URL de esta página: ${pageUrl}
- Tipo de página: ${isHomepage ? 'PÁGINA DE INICIO / PORTADA' : 'página interna (producto, servicio o categoría)'}
- Palabra clave objetivo (la intención real del cliente que buscás capturar): "${keyword || '(no especificada — inferila del contenido de abajo)'}"

CONTEXTO DEL NEGOCIO (de la portada del sitio — sirve para entender el rubro y si es mono o multimarca):
${businessContext ? `  ${businessContext}` : '  (no disponible — deducí el perfil desde el contenido de la página)'}
${brandsBlock}
QUÉ VENDE REALMENTE ESTA PÁGINA (basate en esto para entender el producto puntual):
${pageSells}

CÓMO LE VA HOY EN GOOGLE (usá esto para decidir cuán agresivo ser):
${metricsBlock}

CAMPO A OPTIMIZAR: ${isTitle ? 'el TÍTULO SEO (etiqueta <title>)' : 'la META DESCRIPCIÓN'}
Valor actual de ese campo: "${currentValue || '(vacío)'}"
${goalGuidance ? `\nOBJETIVO PRINCIPAL DEL DUEÑO (orientá la estrategia hacia esto):\n  ${goalGuidance}` : ''}
PASO 1 — IDENTIFICÁ EL PERFIL DE MARCA DEL NEGOCIO (clave para decidir bien):
- MONOMARCA / producto puntual: el negocio vende su propia marca o esta es la página de un solo producto/marca. Señales: una sola marca repetida, página de ficha de producto único.
- MULTIMARCA / distribuidor / tienda que vende muchas marcas. Señales: palabras como "distribuidor", "multimarca", "todas las marcas", "importador", o varios nombres de marcas distintas en el contexto del negocio o la página. Muchos rubros funcionan así (tiendas de detailing, ferreterías, perfumerías, tecnología, repuestos, etc.).

PASO 2 — GENERÁ ${isTitle ? 'el TÍTULO SEO' : 'la META DESCRIPCIÓN'} aplicando las reglas según el perfil.

REGLAS ABSOLUTAS (un experto nunca las rompe):
1. COHERENCIA DE RUBRO ANTE TODO: nunca menciones productos, marcas o categorías de OTRO rubro. Una tienda de car detailing jamás habla de zapatillas; una perfumería jamás de herramientas.
2. SEGÚN EL PERFIL DE MARCA:
   - Si es MONOMARCA / producto puntual: trabajá SOLO con lo que la página realmente vende. No inventes marcas ajenas.
   - Si es MULTIMARCA / distribuidor: PODÉS y CONVIENE incorporar estratégicamente nombres de marcas reconocidas y categorías del MISMO rubro para capturar más búsquedas —incluso marcas que vende la competencia—, porque una tienda multimarca legítimamente atrae ese tráfico. Priorizá SIEMPRE las marcas que el dueño declaró (si las hay arriba) y las que el negocio muestra que distribuye; si sumás una marca reconocida del rubro como jugada de captación, hacelo de forma honesta (como parte del catálogo o en comparación), SIN afirmar ser la marca oficial.
3. PRESERVÁ LA INTENCIÓN DE BÚSQUEDA: nunca elimines la palabra que describe QUÉ es el producto/servicio ni los términos específicos de alta conversión (nombres de partes como "parabrisas", "paragolpes"; el problema que resuelve; el tipo exacto de producto). Si el texto actual tiene un término específico que la gente busca, CONSERVALO.
4. ${isHomepage ? 'ES LA PÁGINA DE INICIO: optimizá para la MARCA + la CATEGORÍA GLOBAL del negocio (ej: "Tienda de Car Detailing"), NUNCA para un producto puntual.' : 'ES UNA PÁGINA INTERNA: optimizá para el producto/servicio específico de esta página, no para la marca genérica.'}
5. USÁ LA POSICIÓN: si ya está en página 1, hacé cambios conservadores (no arruines lo que funciona); si está en página 2 o más lejos, podés ser más agresivo.
6. ELIMINÁ EL RUIDO: sacá gramaje, stock, tamaños y SKUs ("x 50gs/100gs", "500ml", "pack x12") y relleno vacío ("puro", "premium", "original") solo si hace falta para entrar en el límite.
7. DESDUPLICÁ SINÓNIMOS: si hay dos palabras casi iguales ("vidrios" y "cristales"), quedate con la más buscada/específica.
8. NUNCA dejes un título "pelado" tipo "Marca | Tienda". Siempre debe quedar claro qué se vende.
9. ${isTitle ? 'LONGITUD: máximo 60 caracteres (ideal 50-60). Estructura sugerida: [qué es + término de intención] + [marca relevante si aporta] + [nombre de la tienda].' : 'LONGITUD: máximo 155 caracteres. Incluí la palabra clave de intención y un llamado a la acción claro ("Comprá", "Pedí presupuesto", "Conocé más").'}
10. Español rioplatense, natural, sin tecnicismos SEO.
${goalGuidance ? '11. RESPETÁ EL OBJETIVO DEL DUEÑO descrito arriba al elegir el enfoque del texto.' : ''}

En "reason", si detectaste que es multimarca y por eso sumaste una marca o categoría como estrategia, explicáselo en una frase al dueño (ej: "Como tu tienda es multimarca, sumé X para captar a quien busca esa marca").

Devolvé ESTRICTAMENTE este JSON, sin markdown ni texto extra:
{"suggestedTitle": "tu ${isTitle ? 'título' : 'meta descripción'} optimizado", "reason": "frase corta explicando qué decidiste y por qué, relacionando las variables (para el dueño del negocio)"}
`;

  try {
    const result = await invokeGeminiWithCredits({
      email: email || 'dev@localhost',
      isAdmin,
      feature: 'title_suggestion',
      cacheKey,
      prompt,
      apiKey,
    });

    if (result.ok === false) {
      return { success: false, fallback: true as const, code: result.code, credits: result.credits };
    }

    let raw = result.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(raw);
    const suggestedTitle = decodeHtmlEntities((parsed.suggestedTitle || '').trim());
    const reason = (parsed.reason || '').trim();

    if (!suggestedTitle) {
      return { success: false, fallback: true as const, credits: result.credits };
    }

    return { success: true as const, suggestedTitle, reason, credits: result.credits };
  } catch (err: any) {
    console.warn('[getSmartMissionSuggestion] fallback:', err?.message || err);
    return { success: false, fallback: true as const };
  }
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
      
      // No module-level cache — each server action invocation is isolated.
      // The scrape result is used only to enrich the Gemini prompt context;
      // if it fails the pipeline continues with the domain-inferred niche.
      meta = await scrapeMetadata(cleanSiteUrl);
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

    const session = await auth();
    const email = session?.user?.email || '';
    const isAdmin = await checkIsAdmin();
    if (!email && !isAdmin) {
      return { success: false, error: 'Tenés que iniciar sesión para usar la IA.', code: 'NOT_AUTHENTICATED' };
    }

    const cacheKey = buildGeminiCacheKey([
      'buscador_oro',
      email || 'anon',
      cleanSiteUrl,
      cleanSeedKeyword,
      excludedWords || '',
    ]);

    let responseText = "";
    try {
      console.log("[API Debug Buscador] Gemini con créditos...");
      const geminiResult = await invokeGeminiWithCredits({
        email: email || 'dev@localhost',
        isAdmin,
        feature: 'buscador_oro',
        cacheKey,
        prompt: systemInstructions,
        apiKey,
      });
      if (geminiResult.ok === false) {
        return {
          success: false,
          error: geminiResult.error,
          code: geminiResult.code,
          credits: geminiResult.credits,
          upgrade: geminiResult.upgrade,
        };
      }
      responseText = geminiResult.text;
    } catch (geminiErr: any) {
      console.error("[API Debug Detective] REST call failed:", geminiErr.message || geminiErr);
      logErrorToFile(
        "getAIPredictiveSuggestions", 
        { siteUrl: cleanSiteUrl, seedKeyword: cleanSeedKeyword }, 
        geminiErr.status || "503", 
        geminiErr.message || String(geminiErr)
      );
      return { success: false, error: geminiErrorToUserMessage(geminiErr.message || geminiErr) };
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

export async function getQuickWins(
  siteUrl: string,
  goldKeyword?: string,
  excludePages?: string[],
  businessFocus?: string
) {
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

  let cleanBusinessFocus = "";
  if (businessFocus) {
    const focusSanit = sanitizeInput(businessFocus, 'keyword');
    if (focusSanit.isValid) {
      cleanBusinessFocus = focusSanit.sanitized.slice(0, 300);
    }
  }

  const excludeList = (excludePages || [])
    .map(p => String(p).trim())
    .filter(Boolean)
    .slice(0, 30);

  // Hard timeout: never hang more than 20 seconds on Vercel
  const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ success: false, error: "El análisis tardó demasiado. Intentá de nuevo en unos segundos." }), 20000)
  );

  return Promise.race([
    _getQuickWinsCore(cleanSiteUrl, cleanGoldKeyword, excludeList, cleanBusinessFocus),
    timeoutPromise,
  ]);
}

async function _getQuickWinsCore(
  cleanSiteUrl: string,
  cleanGoldKeyword: string,
  excludePages: string[] = [],
  businessFocus: string = ""
) {
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

    // ── LAYER 1: Pre-process — strip product queries from Home page candidates ──
    // If the page is the Home and the GSC query looks like a specific product
    // (i.e. a brand/product name, not a category), we drop that candidate entirely.
    // This prevents the AI from ever seeing a product keyword paired with the Home URL.
    const isProductQuery = (query: string): boolean => {
      if (!query) return false;
      // Institutional/category signals — always safe for Home
      const institutionalTokens = [
        'tienda', 'shop', 'local', 'servicio', 'empresa', 'comprar',
        'mejor', 'precio', 'online', 'argentina', 'buenos aires',
        'delivery', 'envio', 'envios', 'detailing', 'car detailing',
      ];
      const q = query.toLowerCase();
      if (institutionalTokens.some(t => q.includes(t))) return false;
      // Short single/double-word queries that don't include the domain name are
      // likely product/brand names (e.g. "alumax", "limpia llantas", "vintex")
      const words = q.trim().split(/\s+/);
      if (words.length <= 3) {
        // If it matches the raw goldKeyword (or a variant) it's definitely a product
        if (cleanGoldKeyword) {
          const kwLower = cleanGoldKeyword.toLowerCase();
          if (q.includes(kwLower) || kwLower.includes(q)) return true;
        }
        // Heuristic: if none of the words are the business domain, treat as product
        const domainWords = cleanSiteUrl.toLowerCase().replace(/https?:\/\//, '').split(/[.\/\-]/).filter(Boolean);
        const matchesDomain = words.some(w => domainWords.some(d => d.startsWith(w) || w.startsWith(d)));
        if (!matchesDomain) return true;
      }
      return false;
    };

    // Filter candidates first (before scraping)
    // Rule: one Quick Win per physical URL — pick the keyword with the most impressions for each URL.
    // We never block two different URLs from using a similar keyword; that would drop valid pages.
    const urlToBestCand = new Map<string, any>();

    for (const cand of candidates) {
      const pageUrl = cand.keys?.[0];
      const query   = cand.keys?.[1];
      if (!pageUrl || !query) continue;

      // Skip Home page rows that look like specific product queries
      if (isHomePage(pageUrl, cleanSiteUrl) && isProductQuery(query)) {
        console.warn(`[QuickWins L1] Skipping Home candidate with product query: "${query}"`);
        continue;
      }

      const normUrl = pageUrl.replace(/\/$/, "").toLowerCase();
      const existing = urlToBestCand.get(normUrl);

      // Keep the candidate with the highest impressions for this URL
      if (!existing || (cand.impressions || 0) > (existing.impressions || 0)) {
        urlToBestCand.set(normUrl, cand);
      }
    }

    const excludeNorm = new Set(
      excludePages.map(p => p.replace(/\/$/, '').toLowerCase())
    );

    // Hasta 3 candidatos, excluyendo páginas que el usuario descartó
    const validCandidates: any[] = Array.from(urlToBestCand.values())
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .filter(c => !excludeNorm.has((c.keys[0] || '').replace(/\/$/, '').toLowerCase()))
      .slice(0, 3);
    console.log(`[QuickWins L1] Unique-URL candidates selected: ${validCandidates.length} (excluded: ${excludeNorm.size})`);

    if (validCandidates.length === 0) {
      return {
        success: true,
        quickWins: [],
        isMockData: false,
        message: excludeNorm.size > 0
          ? 'No hay más oportunidades en posiciones 8-15 fuera de las que descartaste.'
          : 'No detectamos oportunidades en el rango de posiciones 8 a 15.',
      };
    }


    // Scrape all candidate pages IN PARALLEL (was sequential: up to 5x4s = 20s!)
    const candidateMetas = await Promise.all(
      validCandidates.map(cand =>
        scrapeMetadata(cand.keys[0]).catch(() => ({ title: '', description: '', h1: '' }))
      )
    );

    const opportunities: any[] = validCandidates.map((cand, i) => ({
      page: cand.keys[0],
      keyword: cand.keys[1],
      clicks: cand.clicks || 0,
      impressions: cand.impressions || 0,
      position: cand.position,
      currentTitle: candidateMetas[i].title || '',
      currentDescription: candidateMetas[i].description || '',
      currentH1: candidateMetas[i].h1 || '',
    }));

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
      const needed = templates.filter((t: any) => {
        const pageUrl = cleanSiteUrl.replace(/\/$/, '') + t.path;
        const normPageUrl = pageUrl.replace(/\/$/, "").toLowerCase();
        return !opportunities.some(o => o.page.replace(/\/$/, "").toLowerCase() === normPageUrl);
      }).slice(0, 3 - opportunities.length);

      // Scrape fallback pages IN PARALLEL too
      const fallbackMetas = await Promise.all(
        needed.map((t: any) => {
          if (t.path === '') return Promise.resolve(homeMeta);
          return scrapeMetadata(cleanSiteUrl.replace(/\/$/, '') + t.path).catch(() => ({ title: '', description: '', h1: '' }));
        })
      );

      needed.forEach((t: any, i: number) => {
        const pageUrl = cleanSiteUrl.replace(/\/$/, '') + t.path;
        opportunities.push({
          page: pageUrl,
          keyword: isHomePage(pageUrl, cleanSiteUrl) ? homeNicheKeyword : t.keyword,
          clicks: t.cl,
          impressions: t.imp,
          position: t.pos,
          currentTitle: fallbackMetas[i].title || '',
          currentDescription: fallbackMetas[i].description || '',
          currentH1: fallbackMetas[i].h1 || '',
        });
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY no configurada.");
      return { success: false, error: "GEMINI_API_KEY no configurada en las variables de entorno." };
    }

    // ── Build domain info for the prompt (e.g. "55detailshop.com.ar") ──
    const domainName = (() => { try { return new URL(cleanSiteUrl).hostname; } catch { return cleanSiteUrl; } })();

    const systemInstructions = `
Actúas como un Consultor de Ventas y Estratega Digital entusiasmado y experto en optimización web (SEO). Tu tono debe ser profesional y directo, como un consultor que acaba de encontrar una excelente noticia para el usuario.
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
⚠️  REGLA ABSOLUTA #2 — ÁNGULO ÚNICO ⚠️
██████████████████████████████████████████████████████████████
No intentes combinar múltiples beneficios comerciales distintos si eso compromete la naturalidad del texto (ej: "Brillo y Venta Mayorista" suena forzado y robótico → es incorrecto).
Analizá los datos de la URL (keyword, título actual, contexto del negocio) y elegí el ÚNICO ángulo más potente y de mayor impacto para el usuario. Puede ser:
  - El beneficio técnico del producto (ej: "Brillo Profesional", "Máxima Potencia")
  - El gancho comercial (ej: "Precio Mayorista", "Envío Gratis", "Para Tu Auto")
  - La intención de búsqueda dominante según la keyword y las impresiones
Escribí un título fluido, humano y persuasivo enfocado exclusivamente en ese ángulo elegido.
Cada URL física del listado debe recibir exactamente un único registro en tu JSON final.
██████████████████████████████████████████████████████████████


██████████████████████████████████████████████████████████████
⚠️  REGLA ABSOLUTA #3 — LONGITUD DEL TÍTULO — CRÍTICA PARA SEO ⚠️
██████████████████████████████████████████████████████████████
El campo "suggestedTitle" de CADA oportunidad DEBE tener entre 50 y 60 caracteres de longitud total (incluyendo espacios y caracteres especiales).
- Mínimo: 50 caracteres. Si es más corto, agregá un beneficio o modificador atractivo.
- Máximo ABSOLUTO: 60 caracteres. Si superas los 60 caracteres, Google lo cortará con "..." y el usuario perderá el clic.
- Contá los caracteres mentalmente antes de escribir el título. Si tu primer borrador tiene 70 caracteres, comprimilo.
- Priorizá claridad y beneficio comercial por sobre completitud. Un título de 58 caracteres bien elegido vence a uno de 80.
🔒 VIOLACIÓN DE ESTA REGLA = Título inútil para el cliente. No se mostrará completo en Google.
██████████████████████████████████████████████████████████████

Nexo con la Semilla (Seed Keyword):
${cleanGoldKeyword ? `El usuario está investigando la keyword: "${cleanGoldKeyword}". Úsala en títulos de PÁGINAS INTERNAS (producto, servicio, blog). En la HOME, transformala a su CATEGORÍA GLOBAL (ej: si la keyword es un producto de car detailing → el título de la home habla de la tienda de car detailing, no del producto específico).` : `Asegúrate de que las optimizaciones propuestas se alineen fuertemente con el nicho y metadatos globales del sitio.`}

██████████████████████████████████████████████████████████████
⚠️  REGLA #4 — QUÉ VENDE REALMENTE EL NEGOCIO ⚠️
██████████████████████████████████████████████████████████████
El usuario declaró que vende/ofrece: "${businessFocus || 'No especificado — inferir solo desde metadatos y URL de cada página.'}"
- Si la keyword de GSC es genérica (ej: "pintura automotriz", "pintura para autos") pero el negocio vende algo más específico (vinilo líquido, pintura de retoque, detailing), NO sugieras títulos de taller de repintado.
- Adaptá el título al producto REAL de esa URL y al nicho declarado.
- Si la búsqueda no encaja con lo que venden, decilo en "explanation" y proponé un ángulo honesto (ej: "pintura de retoque" o "vinilo removible" en lugar de "pintura automotriz de taller").
██████████████████████████████████████████████████████████████

██████████████████████████████████████████████████████████████
⚠️  REGLA ABSOLUTA #5 — NUNCA UN TÍTULO PELADO (INTENCIÓN DE BÚSQUEDA) ⚠️
██████████████████████████████████████████████████████████████
El "suggestedTitle" SIEMPRE debe dejar claro QUÉ es el producto o servicio (el término que describe la necesidad real del cliente), no solo la marca.
- PROHIBIDO ABSOLUTO sugerir títulos del estilo "MarcaDelProducto | NombreTienda" que borran la descripción. Ejemplo INVÁLIDO: "Autopint | 55detailshop" (nadie busca la marca "Autopint"; buscan "pintura de retoque de autos").
- Una marca de producto poco conocida (ej: "Autopint") NO reemplaza al término de intención. Debe ir ACOMPAÑADA del término que la gente busca. Ejemplo CORRECTO: "Autopint: Pintura de Retoque de Autos con Pincel | 55detailshop".
- Estructura recomendada: [Término de intención que describe el producto] + [marca del producto si aporta confianza] + [gancho corto opcional] + [nombre de la tienda], todo dentro de 60 caracteres.
- Si para entrar en 60 caracteres tenés que elegir, SACRIFICÁ la marca o el gancho, NUNCA el término que describe qué es el producto.
🔒 VIOLACIÓN = el cliente pierde la búsqueda real y la página deja de posicionar para lo que importa.
██████████████████████████████████████████████████████████████

Reglas de lenguaje:
- NUNCA uses tecnicismos: "canibalización", "backlinks", "DA", "PA", "search intent", "enlazado interno", "thin content".
- TIENES PROHIBIDO usar la palabra "Socio" o "Socia". Háblale al usuario de forma directa y respetuosa, con un tono más serio pero motivador.
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

    const userEmail = session?.user?.email || '';
    const isAdmin = await checkIsAdmin();
    if (!userEmail && !isAdmin) {
      return { success: false, error: 'Tenés que iniciar sesión para usar Quick Wins con IA.', code: 'NOT_AUTHENTICATED' };
    }

    const cacheKey = buildGeminiCacheKey([
      'quick_wins',
      userEmail || 'dev@localhost',
      cleanSiteUrl,
      cleanGoldKeyword,
      businessFocus,
      excludePages.join('|'),
      JSON.stringify(opportunities.map((o: any) => o.page + o.keyword)),
    ]);

    console.log("[API Debug QuickWins] Gemini con créditos...");
    const geminiResult = await invokeGeminiWithCredits({
      email: userEmail || 'dev@localhost',
      isAdmin,
      feature: 'quick_wins',
      cacheKey,
      prompt: systemInstructions + "\n\n" + userPrompt,
      apiKey,
    });
    if (geminiResult.ok === false) {
      return {
        success: false,
        error: geminiResult.error,
        code: geminiResult.code,
        credits: geminiResult.credits,
        upgrade: geminiResult.upgrade,
      };
    }
    const responseText = geminiResult.text;

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

    // ── LAYER 1.5: DEDUPLICATE RESPONSE BY URL ──
    const dedupedParsed: any[] = [];
    const seenParsedUrls = new Set<string>();
    for (const item of parsed) {
      if (!item || !item.page) continue;
      const normPage = item.page.replace(/\/$/, "").toLowerCase();
      if (!seenParsedUrls.has(normPage)) {
        seenParsedUrls.add(normPage);
        dedupedParsed.push(item);
      } else {
        console.warn(`[QuickWins L1.5] Dropping duplicate AI response entry for URL: ${item.page}`);
      }
    }
    parsed = dedupedParsed;

    // ── LAYER 2: POST-PROCESS SAFETY NET ────────────────────────────────────
    // Even if the AI ignored every instruction, we detect and correct ANY Home
    // title that contains a product/brand keyword — regardless of its position.
    const domainLabel = (() => { try { return new URL(cleanSiteUrl).hostname.split('.')[0]; } catch { return ''; } })();
    const brandFallbackTitle = businessNiche.split('|')[0].trim() ||
      `${domainLabel ? domainLabel.charAt(0).toUpperCase() + domainLabel.slice(1) + ' | ' : ''}Tienda Online`;

    // Collect all product terms to check against: goldKeyword + the actual GSC queries used for Home
    const homeProductTerms: string[] = [];
    if (cleanGoldKeyword) homeProductTerms.push(cleanGoldKeyword.toLowerCase());
    // Also collect the raw queries from the original GSC rows that were mapped to the Home
    for (const row of gscRows) {
      const rowPage = row.keys?.[0] || '';
      const rowQuery = row.keys?.[1] || '';
      if (isHomePage(rowPage, cleanSiteUrl) && rowQuery && isProductQuery(rowQuery)) {
        homeProductTerms.push(rowQuery.toLowerCase());
      }
    }

    parsed = parsed.map((win: any) => {
      if (!isHomePage(win.page, cleanSiteUrl)) return win; // Only apply to Home
      const titleLower = (win.suggestedTitle || '').toLowerCase();
      // Check if ANY known product term appears anywhere in the suggested title
      const offendingTerm = homeProductTerms.find(term => titleLower.includes(term));
      if (offendingTerm) {
        console.warn(`[QuickWins L2] Correcting Home title — found product term "${offendingTerm}" in: "${win.suggestedTitle}"`);
        win.suggestedTitle = brandFallbackTitle;
        win.explanation = `(Corrección automática) ${win.explanation}`;
      }
      return win;
    });
    // ────────────────────────────────────────────────────────────────────────

    // ── LAYER 3: TITLE LENGTH SAFETY NET (max 60 chars) ─────────────────────
    // If the AI still produced an overlong title despite the instruction,
    // we trim it cleanly at the last word boundary before the 60-char limit.
    const MAX_TITLE_LENGTH = 60;
    const trimTitle = (title: string): string => {
      if (!title || title.length <= MAX_TITLE_LENGTH) return title;
      // Try to cut at the last space before position 60 to avoid mid-word cuts
      const cut = title.lastIndexOf(' ', MAX_TITLE_LENGTH - 1);
      const trimmed = cut > 30 ? title.slice(0, cut) : title.slice(0, MAX_TITLE_LENGTH);
      console.warn(`[QuickWins L3] Title trimmed from ${title.length} to ${trimmed.length} chars: "${trimmed}"`);
      return trimmed;
    };
    parsed = parsed.map((win: any) => {
      if (win.suggestedTitle) {
        win.suggestedTitle = trimTitle(win.suggestedTitle);
      }
      return win;
    });
    // ────────────────────────────────────────────────────────────────────────

    // ── Filtrar Quick Wins ya completados en Supabase ─────────────────────
    // Si el usuario ya verificó una oportunidad en una sesión anterior,
    // no vuelve a aparecer — memoria real entre sesiones.
    if (session?.user?.email) {
      try {
        const doneMissions = await getMissionsByEmail(session.user.email, 'completed');
        const doneQuickWinUrls = new Set(
          doneMissions
            .filter(m => m.mission_type === 'QUICK_WIN')
            .map(m => m.target_url)
        );
        const workedPagePaths = new Set(
          doneMissions
            .filter(m => ['H1', 'META', 'ALT'].includes(m.mission_type))
            .map(m => normalizePagePath(m.target_url))
        );
        if (doneQuickWinUrls.size > 0 || workedPagePaths.size > 0) {
          parsed = parsed.filter((win: any) => {
            if (doneQuickWinUrls.has(win.page)) return false;
            if (workedPagePaths.has(normalizePagePath(win.page))) return false;
            return true;
          });
          console.log(`[QuickWins] Filtradas oportunidades ya trabajadas para ${session.user.email}`);
        }
      } catch (filterErr) {
        console.warn('[QuickWins] No se pudieron filtrar misiones completadas:', filterErr);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    return { success: true, quickWins: parsed, isMockData };
  } catch (error: any) {
    console.error("Error en getQuickWins:", error);
    return {
      success: false,
      error: geminiErrorToUserMessage(error.message || error),
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
Actuás como un Consultor de Ventas y Estratega Digital entusiasmado que acaba de descubrir oportunidades enormes de mejora en el sitio web de un cliente. Tu tono es profesional y amigable, como un experto que encontró dinero sobre la mesa.
TIENES PROHIBIDO usar la palabra "Socio" o "Socia". Háblale al usuario de forma directa y respetuosa, con un tono más serio pero motivador.

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

    const session = await auth();
    const userEmail = session?.user?.email || '';
    const isAdmin = await checkIsAdmin();
    if (!userEmail && !isAdmin) {
      return { success: false, error: 'Tenés que iniciar sesión para usar el Detective con IA.', code: 'NOT_AUTHENTICATED' };
    }

    const cacheKey = buildGeminiCacheKey([
      'detective_enlaces',
      userEmail || 'dev@localhost',
      cleanSiteUrl,
      goldKeyword || '',
      String(stats.brokenCount),
      String(stats.genericAnchors),
      String(stats.orphanPages),
    ]);

    const geminiResult = await invokeGeminiWithCredits({
      email: userEmail || 'dev@localhost',
      isAdmin,
      feature: 'detective_enlaces',
      cacheKey,
      prompt: promptText,
      apiKey,
    });

    if (geminiResult.ok === false) {
      return {
        success: false,
        error: geminiResult.error,
        code: geminiResult.code,
        credits: geminiResult.credits,
        upgrade: geminiResult.upgrade,
      };
    }

    const rawText = geminiResult.text;

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
    const raw = String(error.message || error);
    const isGemini = /gemini|429|prepayment|quota/i.test(raw);
    const userMessage = isGemini
      ? geminiErrorToUserMessage(raw)
      : "Error al escanear el sitio. Verificá que la URL sea correcta e intentá de nuevo.";
    return { success: false, error: userMessage };
  }
}

// ─── Persistencia de misiones en Supabase ─────────────────────────────────────

/**
 * Marca una misión como completada en Supabase.
 * Llamar desde el cliente después de verificar exitosamente una misión o Quick Win.
 */
export async function markMissionComplete(
  missionType: MissionType,
  targetUrl: string,
  xpAwarded: number = 0,
  suggestedValue?: string
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false };
  }
  const result = await completeMission(
    session.user.email,
    missionType,
    targetUrl,
    xpAwarded,
    suggestedValue
  );
  return { success: !!result };
}

/**
 * Obtiene todas las misiones completadas del usuario desde Supabase.
 * Usar en el arranque de la app para restaurar el estado entre sesiones.
 */
export async function fetchCompletedMissions(): Promise<{
  success: boolean;
  missions: Awaited<ReturnType<typeof getMissionsByEmail>>;
}> {
  const session = await auth();
  if (!session?.user?.email) {
    console.warn('[Supabase] fetchCompletedMissions: Sin sesión autenticada, devolviendo vacío.');
    return { success: false, missions: [] };
  }
  console.log(`[Supabase] fetchCompletedMissions: cargando misiones para ${session.user.email}`);
  const missions = await getMissionsByEmail(session.user.email, 'completed');
  console.log(`[Supabase] fetchCompletedMissions: ${missions.length} misión(es) completada(s) encontradas para ${session.user.email}`);
  return { success: true, missions };
}

/**
 * Elimina todos los datos del usuario en nuestros servidores (Supabase + backup local).
 * El cliente debe borrar localStorage y cerrar sesión después de llamar a esta acción.
 */
export async function deleteUserAccount(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: 'No hay sesión activa' };
  }

  const email = session.user.email;

  try {
    const deleted = await deleteProfileByEmail(email);
    if (!deleted) {
      return { success: false, error: 'No se pudieron borrar los datos en el servidor' };
    }

    try {
      const dataDir = path.join(process.cwd(), 'data', 'user-states');
      const sanitizedEmail = email.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const filePath = path.join(dataDir, `${sanitizedEmail}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileErr) {
      console.warn('[deleteUserAccount] No se pudo borrar archivo de estado local:', fileErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error('[deleteUserAccount] Error:', err);
    return { success: false, error: err?.message || 'Error al eliminar la cuenta' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AEO ENGINE — Answer Engine Optimization
// ═══════════════════════════════════════════════════════════════════════════

type HeadingSection = {
  heading: string;
  headingTag: 'H2' | 'H3';
  paragraphText: string;
  charCount: number;
};

/**
 * Fetch a page's HTML and extract H2/H3 headings with their following paragraph text.
 * Used by getAeoOpportunities to gather real content for Gemini analysis.
 */
async function scrapeHeadingSections(pageUrl: string): Promise<HeadingSection[]> {
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

      // Find the next <p> tag after this heading in the HTML
      const afterHeading = html.substring(match.index + match[0].length);
      const pMatch = afterHeading.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      let paragraphText = '';
      if (pMatch) {
        paragraphText = pMatch[1].replace(/<[^>]+>/g, '').trim();
      }

      // Filter: skip sections where paragraph is empty or less than 20 chars
      if (!paragraphText || paragraphText.length < 20) continue;

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

/**
 * Main AEO server action. Analyzes user's pages and generates AEO optimization
 * opportunities via Gemini. Returns "Snacks Informativos" — ultra-concise rewrites
 * optimized for AI citation by ChatGPT, Gemini, and Perplexity.
 */
export async function getAeoOpportunities(
  siteUrl: string,
  goldKeyword?: string,
  manualUrl?: string,
  businessFocus?: string
) {
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
  // Hard timeout: never hang more than 20 seconds
  const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) =>
    setTimeout(() => resolve({ success: false, error: "El análisis AEO tardó demasiado. Intentá de nuevo." }), 20000)
  );

  let cleanBusinessFocus = "";
  if (businessFocus) {
    const focusSanit = sanitizeInput(businessFocus, 'keyword');
    if (focusSanit.isValid) {
      cleanBusinessFocus = focusSanit.sanitized.slice(0, 300);
    }
  }

  return Promise.race([
    _getAeoCore(cleanSiteUrl, cleanGoldKeyword, manualUrl, cleanBusinessFocus),
    timeoutPromise,
  ]);
}

async function _getAeoCore(
  cleanSiteUrl: string,
  cleanGoldKeyword: string,
  manualUrl?: string,
  businessFocus: string = ""
): Promise<any> {
  try {
    const session = await auth();

    // ── Determine which pages to analyze (up to 3) ─────────────────────────
    const pagesToAnalyze: string[] = [];

    // If manualUrl is provided and valid, add it as the FIRST page
    if (manualUrl) {
      const manualSanit = sanitizeInput(manualUrl, 'url');
      if (manualSanit.isValid) {
        let cleanManualUrl = manualSanit.sanitized;
        if (!cleanManualUrl.startsWith('http://') && !cleanManualUrl.startsWith('https://')) {
          cleanManualUrl = 'https://' + cleanManualUrl;
        }
        pagesToAnalyze.push(cleanManualUrl);
      }
    }

    // Get GSC data and pick top pages by impressions in position 11-20
    if (session?.accessToken) {
      try {
        const gscRows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanGoldKeyword || undefined, 100);

        // Filter for position 11-20 (just outside top 10 = ripe for AEO)
        const candidates = gscRows.filter((row: any) => {
          const pos = row.position;
          return pos >= 11 && pos <= 20;
        });

        // Sort by impressions DESC
        candidates.sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0));

        // Take top pages until we have 3 total (skip duplicates with manualUrl)
        for (const cand of candidates) {
          if (pagesToAnalyze.length >= 3) break;
          const pageUrl = cand.keys[0];
          // Normalize for dedup
          const normPage = pageUrl.replace(/\/+$/, '').toLowerCase();
          const isDuplicate = pagesToAnalyze.some(
            p => p.replace(/\/+$/, '').toLowerCase() === normPage
          );
          if (!isDuplicate) {
            pagesToAnalyze.push(pageUrl);
          }
        }
      } catch (err: any) {
        console.warn("[AEO] Fallo al obtener datos de GSC:", err.message);
      }
    }

    // Fallback: just the siteUrl home page if no pages found
    if (pagesToAnalyze.length === 0) {
      let homeUrl = cleanSiteUrl;
      if (!homeUrl.startsWith('http://') && !homeUrl.startsWith('https://')) {
        homeUrl = 'https://' + homeUrl;
      }
      pagesToAnalyze.push(homeUrl);
    }

    // ── Scrape heading sections from each page IN PARALLEL ────────────────
    const allSections: Array<{ pageUrl: string; heading: string; headingTag: string; paragraphText: string }> = [];

    const scrapeResults = await Promise.all(
      pagesToAnalyze.slice(0, 3).map(async (pageUrl) => {
        try {
          const sections = await scrapeHeadingSections(pageUrl);
          return sections.map(sec => ({
            pageUrl,
            heading: sec.heading,
            headingTag: sec.headingTag,
            paragraphText: sec.paragraphText,
          }));
        } catch {
          return [];
        }
      })
    );
    for (const result of scrapeResults) {
      allSections.push(...result);
    }

    if (allSections.length === 0) {
      return { success: true, data: [] };
    }

    // ── Call Gemini ───────────────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY no configurada.");
      return { success: false, error: "GEMINI_API_KEY no configurada en las variables de entorno." };
    }

    const systemInstructions = `Actuás como un Ingeniero Consultor Senior de AEO (Answer Engine Optimization) y GEO (Generative Engine Optimization). Tu único objetivo es analizar fragmentos de texto de la web de un usuario y transformarlos en "Snacks Informativos": respuestas directas, ultra-concisas y semánticamente perfectas para ser devoradas por modelos de lenguaje de IA.

Reglas de Oro para la Optimización (El Formato "Snack"):
1. La Regla de los 150-200 caracteres: La respuesta al encabezado (H2/H3) debe arrancar de forma inmediata en el primer párrafo. No debe dar rodeos, ni introducciones poéticas, ni usar lenguaje corporativo/ventas.
2. Estructura Semántica Directa: Debe responder al "Qué", "Cómo" o "Cuánto" usando el verbo en la primera frase de forma asertiva.
3. Extensión Máxima: Entre 40 y 50 palabras por respuesta optimizada.
4. Eliminación de Fluff: Remover adjetivos de marketing (ej. "somos los mejores", "líderes en el mercado", "revolucionario"). La IA busca datos objetivos y resolutivos.

EJEMPLOS DE ENTRENAMIENTO:

Ejemplo 1 - Input Heading: "¿Qué es el sellado cerámico?"
Texto pésimo: "En 55 Detail Shop nos apasiona cuidar tu auto como si fuera nuestro. Por eso, nuestro sellado cerámico es la opción ideal si buscás el brillo más espectacular del mercado..."
Texto optimizado correcto: "El sellado cerámico es un recubrimiento de polímero líquido que se aplica sobre la laca del vehículo. Al curar, se une químicamente a la pintura creando una capa hidrofóbica permanente de dióxido de silicio (SiO2) que protege contra rayos UV, químicos y marcas circulares."

Ejemplo 2 - Input Heading: "¿Cuánto dura el tratamiento para plásticos del interior?"
Texto pésimo: "La duración de nuestro producto Black Line es realmente muy buena y te va a sorprender desde la primera aplicación..."
Texto optimizado correcto: "Un tratamiento para plásticos interiores de alta calidad dura entre 3 y 6 meses, dependiendo de la exposición solar y el uso del vehículo. Las fórmulas basadas en SiO2 generan una barrera antiestática duradera que resiste la degradación por rayos UV sin dejar residuos grasos."

Para cada sección que analices, devolvé estrictamente un JSON. Si el texto actual YA es bueno para AEO (responde directo, sin fluff, con datos objetivos), marcá is_opportunity como false.

Devolvé un array JSON sin bloques de código markdown:
[
  {
    "is_opportunity": true,
    "section_index": 0,
    "heading_affected": "texto exacto del heading",
    "heading_tag": "H2 o H3",
    "current_text_snippet": "primeros 100 chars del texto actual...",
    "problem_identified": "Diagnóstico breve de por qué la IA no lo citaría",
    "optimized_text_replacement": "Texto optimizado de 40-50 palabras listo para copiar y pegar",
    "word_count": 45
  }
]`;

    const userPrompt = `Analizá las siguientes secciones de texto extraídas de la web del usuario.
Palabra clave del negocio: "${cleanGoldKeyword || 'no especificada'}"
Qué vende/ofrece el negocio: "${businessFocus || 'no especificado — basate en el contenido de cada sección'}"

Secciones a analizar:
${JSON.stringify(allSections, null, 2)}`;

    const userEmail = session?.user?.email || '';
    const isAdmin = await checkIsAdmin();
    if (!userEmail && !isAdmin) {
      return { success: false, error: 'Tenés que iniciar sesión para usar AEO con IA.', code: 'NOT_AUTHENTICATED' };
    }

    const cacheKey = buildGeminiCacheKey([
      'aeo',
      userEmail || 'dev@localhost',
      cleanSiteUrl,
      cleanGoldKeyword,
      businessFocus,
      manualUrl || '',
      JSON.stringify(allSections.map((s) => s.pageUrl + s.heading).slice(0, 20)),
    ]);

    console.log("[API Debug AEO] Gemini con créditos...");
    const geminiResult = await invokeGeminiWithCredits({
      email: userEmail || 'dev@localhost',
      isAdmin,
      feature: 'aeo',
      cacheKey,
      prompt: systemInstructions + "\n\n" + userPrompt,
      apiKey,
    });
    if (geminiResult.ok === false) {
      return {
        success: false,
        error: geminiResult.error,
        code: geminiResult.code,
        credits: geminiResult.credits,
        upgrade: geminiResult.upgrade,
      };
    }
    const responseText = geminiResult.text;

    // ── Parse JSON response ──────────────────────────────────────────────
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
      console.error("Error parseando JSON de Gemini para AEO:", responseText, parseErr);
      return { success: false, error: "Error al interpretar la respuesta de la IA." };
    }

    // ── Filter: only keep sections where is_opportunity is true ──────────
    let opportunities = parsed.filter((item: any) => item.is_opportunity === true);

    // ── Add pageUrl to each opportunity result ──────────────────────────
    opportunities = opportunities.map((opp: any) => {
      const sectionIdx = opp.section_index ?? 0;
      const matchedSection = allSections[sectionIdx];
      return {
        ...opp,
        pageUrl: matchedSection?.pageUrl || pagesToAnalyze[0] || cleanSiteUrl,
      };
    });

    // ── Filter already-completed AEO_OPP missions from Supabase ─────────
    if (session?.user?.email) {
      try {
        const doneMissions = await getMissionsByEmail(session.user.email, 'completed');
        const doneAeoKeys = new Set(
          doneMissions
            .filter(m => m.mission_type === 'AEO_OPP')
            .map(m => buildAeoKey(m.target_url, m.suggested_value || ''))
        );
        if (doneAeoKeys.size > 0) {
          opportunities = opportunities.filter(
            (opp: any) => !doneAeoKeys.has(buildAeoKey(opp.pageUrl, opp.heading_affected))
          );
          console.log(`[AEO] Filtradas ${doneAeoKeys.size} oportunidad(es) AEO ya completada(s) para ${session.user.email}`);
        }
      } catch (filterErr) {
        console.warn('[AEO] No se pudieron filtrar misiones completadas:', filterErr);
      }
    }

    return { success: true, data: opportunities };
  } catch (error: any) {
    console.error("Error en getAeoOpportunities:", error);
    logErrorToFile(
      "getAeoOpportunities",
      { siteUrl: cleanSiteUrl, goldKeyword: cleanGoldKeyword, manualUrl },
      error.status || "500",
      error.message || String(error)
    );
    return { success: false, error: geminiErrorToUserMessage(error.message || error) };
  }
}

/**
 * Verifies that the user actually applied the optimized AEO text on their page.
 * Fetches the live page and checks if significant words from the optimized text
 * appear near the specified heading.
 */
export async function verifyAeoMission(pageUrl: string, headingText: string, optimizedText: string) {
  if (!pageUrl || !headingText?.trim() || !optimizedText?.trim()) {
    return { success: false, message: 'Faltan datos para verificar.' };
  }

  let html: string;
  try {
    console.log(`[verifyAeoMission] Fetching page (no-cache): ${pageUrl}`);
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
    if (err?.name === 'TimeoutError') {
      return { success: false, message: 'La página tardó demasiado en responder (>8s). Intentá de nuevo.' };
    }
    return { success: false, message: `Error al acceder a la página: ${err?.message}` };
  }

  // Strip script and style tags (same pattern as verifyContentMission)
  let cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  // Find the heading in the HTML (case-insensitive search using normalize)
  const normalizedHeading = normalize(headingText);
  const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let headingMatch;
  let headingEndIndex = -1;

  while ((headingMatch = headingRegex.exec(cleanHtml)) !== null) {
    const extractedHeading = headingMatch[1].replace(/<[^>]+>/g, '').trim();
    if (normalize(extractedHeading) === normalizedHeading) {
      headingEndIndex = headingMatch.index + headingMatch[0].length;
      break;
    }
  }

  if (headingEndIndex === -1) {
    return {
      success: false,
      message: `No detectamos el texto optimizado en tu web. ¿Ya lo pegaste y borraste la caché? El heading "${headingText}" todavía tiene el contenido anterior.`,
    };
  }

  // Extract text content after the heading until the next heading tag (h1-h6) or end
  const afterHeading = cleanHtml.substring(headingEndIndex);
  const nextHeadingMatch = afterHeading.match(/<h[1-6][^>]*>/i);
  const sectionContent = nextHeadingMatch
    ? afterHeading.substring(0, nextHeadingMatch.index)
    : afterHeading;

  // Strip HTML tags to get plain text
  const sectionText = sectionContent.replace(/<[^>]+>/g, ' ').trim();

  // Normalize both texts for comparison
  const normalizedSection = normalize(sectionText);
  const normalizedOptimized = normalize(optimizedText);

  // Word-by-word comparison: extract significant words (length > 3) from optimizedText
  const significantWords = normalizedOptimized
    .split(' ')
    .filter(w => w.length > 3);

  if (significantWords.length === 0) {
    return {
      success: false,
      message: `No detectamos el texto optimizado en tu web. ¿Ya lo pegaste y borraste la caché? El heading "${headingText}" todavía tiene el contenido anterior.`,
    };
  }

  // Check what percentage appear in the extracted text
  const matchCount = significantWords.filter(w => normalizedSection.includes(w)).length;
  const matchPercentage = matchCount / significantWords.length;

  console.log(`[verifyAeoMission] Heading: "${headingText}" | Match: ${(matchPercentage * 100).toFixed(1)}% (${matchCount}/${significantWords.length} words)`);

  if (matchPercentage >= 0.6) {
    return {
      success: true,
      message: "¡Snack informativo detectado! Tu sección ahora está optimizada para ser citada por ChatGPT, Gemini y Perplexity. 🤖",
    };
  } else {
    return {
      success: false,
      message: `No detectamos el texto optimizado en tu web. ¿Ya lo pegaste y borraste la caché? El heading "${headingText}" todavía tiene el contenido anterior.`,
    };
  }
}
