"use server"

import fs from "fs"
import path from "path"
import { signIn, signOut, auth } from "../auth"
import { getSearchConsoleData, submitGoogleIndexing, getSearchConsoleConnectionStatus, getPageQueryMetrics } from "./google"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { completeMission, getMissionsByEmail, getMissionsPendingSeoWinCheck, markMissionWinNotified, deleteProfileByEmail, updateSubscriptionPlan, getCompetitorSnapshot, saveCompetitorSnapshot, listCompetitorUrls, type MissionType, type MissionBaselineInput, type CompetitorSnapshot } from './supabase'
import { normalizePagePath, pathSlug, buildAeoKey } from './missionMemory'
import { detectSeoWin, buildSeoWinMessage } from './seoWins'
import {
  getAiCreditsStatus,
  getUserPlanSnapshot,
  getCachedGeminiResponse,
  buildGeminiCacheKey,
  type AiCreditsStatus,
} from './aiCredits'
import { MAX_COMPETITORS_BY_PLAN } from './planLimits'
import { decodeHtmlEntities } from './textUtils'
import {
  scrapeMetadata,
  scrapeHeadingSections,
  fetchPage,
  extractLinksFromHtml,
  extractHumanSignals,
  isUiNavigationHeading,
  isUiNoiseText,
} from './scraping'
import { buildCompetitorSnapshot, enrichSpyGaps, type SpyGapEnriched } from './spySnapshot'
import {
  computeHumanScore,
  humanDimensionPasses,
  type HumanDimensionId,
  type HumanMission,
} from './humanScore'
import { fitSeoTitle, extractBrandHints, MAX_SEO_TITLE_LENGTH } from './seoTitle'
import {
  analyzeComprehension,
  getFaqStructurePasteGuide,
  extractExistingStructuredData,
  extractFaqPairs,
  buildFaqJsonLd,
  detectProductInfo,
  buildProductJsonLd,
} from './comprehension'
import { detectSchemaInstallHints } from './schemaPasteGuide'
import {
  isHomePage,
  isCatalogHubPage,
  isContentPage,
  isValidLinkSourcePage,
  filterInternalLinkingRecs,
  filterAnchorTextRecs,
  crawlSiteLinks,
} from './linkAudit'
import {
  readGeminiApiKey,
  parseTitleSuggestionFromGemini,
  geminiErrorToUserMessage,
} from './gemini'
import {
  isQuestionQuery,
  cleanGscKeyword,
  opportunityScore,
  deriveBrandTokens,
  isMostlySiteBrand,
} from './gscScoring'
import {
  extractFromHtml,
  normalize,
  inferNichoFromUrl,
} from './pageContent'
import { sanitizeInput, logErrorToFile } from './inputValidation'
import { invokeGeminiWithCredits } from './aiInvoke'

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
 * Diagnóstico de conexión con Search Console para el sitio del usuario.
 * Aditivo y sin efectos: solo informa a la UI para guiar al usuario.
 * Devuelve 'connected' | 'no_property' | 'no_scope' | 'error' | 'no_site'.
 */
export async function checkSearchConsoleStatus(
  siteUrl: string
): Promise<{ status: string; matchedProperty: string | null; properties: string[] }> {
  try {
    const cleanSite = (siteUrl || '').trim();
    if (!cleanSite) {
      return { status: 'no_site', matchedProperty: null, properties: [] };
    }
    const session = await auth();
    if (!session?.user?.email) {
      return { status: 'no_scope', matchedProperty: null, properties: [] };
    }
    const normalized = cleanSite.startsWith('http') ? cleanSite : `https://${cleanSite}`;
    return await getSearchConsoleConnectionStatus(session.accessToken, normalized);
  } catch (err) {
    console.warn('[checkSearchConsoleStatus]', err);
    return { status: 'error', matchedProperty: null, properties: [] };
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
 * Activa plan PRO o Agencia manualmente (solo admin). Backup si falla webhook de pagos.
 */
export async function activateUserPlan(
  targetEmail: string,
  plan: 'free' | 'pro' | 'agency',
  months: number = 1
): Promise<{ success: boolean; error?: string }> {
  try {
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

    const result = await updateSubscriptionPlan(email, plan, expiresAt);
    if (!result.ok) {
      return {
        success: false,
        error:
          result.error ||
          'No se pudo actualizar el plan. Revisá Supabase (migración 003) o variables en Vercel.',
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error:
        /fetch failed/i.test(message)
          ? 'No se pudo conectar con Supabase desde el servidor. Revisá NEXT_PUBLIC_SUPABASE_URL en Vercel y probá /api/debug-supabase'
          : message,
    };
  }
}

// invokeGeminiWithCredits y GeminiCreditResult viven en ./aiInvoke
// sanitizeInput y logErrorToFile viven en ./inputValidation

// Los helpers de Gemini (callGeminiREST, readGeminiApiKey, geminiKeyHint,
// parseTitleSuggestionFromGemini, geminiErrorToUserMessage) viven en ./gemini

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


// El motor de scoring de keywords (isQuestionQuery, cleanGscKeyword,
// positionOpportunityWeight, opportunityScore, deriveBrandTokens,
// isMostlySiteBrand) vive en ./gscScoring

/**
 * Misiones de ARRANQUE (sin Search Console).
 * La mayoría de los negocios no tienen GSC conectado. En vez de dejar la app
 * vacía (y perder al usuario), analizamos la web con el scraper y generamos
 * misiones reales basadas en lo que se ve en el sitio. Cuando el usuario conecte
 * GSC, estas se reemplazan por las misiones con datos reales de Google.
 * Cada misión queda marcada con source:'web' para diferenciarla en la UI.
 */
async function buildStarterMissions(
  cleanSiteUrl: string,
  goldKeyword: string,
  _goal: string
): Promise<any[]> {
  const homeUrl = cleanSiteUrl.startsWith('http') ? cleanSiteUrl : `https://${cleanSiteUrl}`;

  // 1. Traer la portada y descubrir páginas internas reales.
  let internalPaths: string[] = [];
  try {
    const home = await fetchPage(homeUrl);
    if (home.ok && home.html) {
      const links = extractLinksFromHtml(home.html, homeUrl);
      const seen = new Set<string>();
      const skip = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|mp4|css|js)(\?|$)/i;
      const skipPaths = /(\/wp-admin|\/wp-login|\/cart|\/carrito|\/checkout|\/finalizar|\/mi-cuenta|\/my-account|\/account|\/login|\/registro|\/feed|\/tag\/|\/etiqueta\/|\/author\/|\/autor\/)/i;
      for (const link of links) {
        if (!link.isInternal) continue;
        if (skip.test(link.href) || skipPaths.test(link.href)) continue;
        let path = '';
        try { path = new URL(link.href).pathname.replace(/\/+$/, ''); } catch { continue; }
        if (!path || path === '') continue;            // saltar la home
        if (path.split('/').filter(Boolean).length > 3) continue; // muy profundo
        if (seen.has(path)) continue;
        seen.add(path);
        internalPaths.push(new URL(link.href).origin + path);
      }
    }
  } catch (e: any) {
    console.warn('[buildStarterMissions] No se pudo leer la portada:', e?.message || e);
  }

  // Priorizar páginas con señales de producto/servicio/categoría.
  const prioritySignal = /(producto|product|tienda|shop|servicio|service|categoria|category|catalogo|coleccion|collection)/i;
  internalPaths.sort((a, b) => (prioritySignal.test(b) ? 1 : 0) - (prioritySignal.test(a) ? 1 : 0));

  // Lista final de páginas a analizar: internas (hasta 4) o, si no hay, la home.
  const pageUrls = internalPaths.slice(0, 4);
  if (pageUrls.length === 0) pageUrls.push(homeUrl);

  // 2. Scrapear metadatos de cada página en paralelo.
  const metas = await Promise.all(
    pageUrls.map((u) => scrapeMetadata(u).catch(() => ({ title: '', description: '', h1: '' })))
  );

  // 3. Construir una misión por página, eligiendo el arreglo más necesario.
  const missions: any[] = [];
  pageUrls.forEach((fullPageUrl, i) => {
    const meta = metas[i];
    const title = (meta.title || '').trim();
    const h1 = (meta.h1 || '').trim();
    const description = (meta.description || '').trim();

    // Diagnóstico simple de la página.
    const needsTitle = !title || title.length > 60 || !h1;
    const needsMeta = !description || description.length < 50;
    const missionType: 'H1' | 'META' = needsTitle ? 'H1' : (needsMeta ? 'META' : 'H1');

    // Puntaje de "problema" para ordenar (más problemas → más arriba).
    let issue = 0;
    if (!title) issue += 2;
    if (!h1) issue += 2;
    if (title && title.length > 60) issue += 1;
    if (!description) issue += 1;

    let pagePath = '/';
    try { pagePath = normalizePagePath(fullPageUrl); } catch { /* keep */ }

    // Keyword: slug legible de la URL o la semilla del usuario.
    let derivedKw = '';
    try {
      const segs = new URL(fullPageUrl).pathname.replace(/\/+$/, '').split('/').filter(Boolean);
      derivedKw = (segs[segs.length - 1] || '').replace(/-/g, ' ').trim();
    } catch { /* ignore */ }
    const effectiveKeyword = derivedKw || goldKeyword || '';

    let displayPath = pagePath;
    if (displayPath === '/' || displayPath === '') {
      displayPath = 'Página de Inicio (Portada)';
    } else {
      displayPath = displayPath.replace(/^\/+|\/+$/g, '').replace(/[-/]/g, ' ');
      if (displayPath.length > 0) displayPath = displayPath.charAt(0).toUpperCase() + displayPath.slice(1);
      if (displayPath.length > 40) displayPath = displayPath.slice(0, 37) + '...';
    }

    const MISSION_TYPES = buildMissionTypes(effectiveKeyword);
    const missionDef = MISSION_TYPES.find((m) => m.type === missionType)!;

    missions.push({
      id: `${missionDef.type.toLowerCase()}-${pagePath}`,
      title: missionDef.title,
      description: missionDef.descriptionTemplate(displayPath),
      xp: missionDef.xp,
      page: fullPageUrl,
      pagePath,
      type: missionDef.type,
      icon: missionDef.icon,
      color: missionDef.color,
      pistas: missionDef.pistas,
      keyword: effectiveKeyword,
      // Sin GSC no hay métricas reales: se omiten para no mostrar "0 ventas".
      clicks: null,
      impressions: null,
      ctr: null,
      position: null,
      opportunity: issue,
      source: 'web',
    });
  });

  // Más problemas primero; tope de 6 para no abrumar.
  missions.sort((a, b) => (b.opportunity || 0) - (a.opportunity || 0));
  return missions.slice(0, 6);
}

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

    // Sin token de Search Console NO bloqueamos: generamos misiones de arranque
    // analizando la web. La mayoría de los negocios entran así la primera vez.
    if (!session?.accessToken) {
      const starter = await buildStarterMissions(cleanSiteUrl, cleanGoldKeyword, cleanGoal);
      return { success: true, data: starter, source: 'web' };
    }

    const rowLimit = cleanGoldKeyword ? 75 : 100;
    let rows: any[] = [];
    try {
      rows = await getSearchConsoleData(session.accessToken, cleanSiteUrl, cleanGoldKeyword || undefined, rowLimit)
    } catch (gscErr: any) {
      // Falta de permiso GSC o propiedad no verificada: en vez de dejar al
      // usuario trabado, le damos misiones de arranque basadas en su web.
      console.warn('[getRealMissions] GSC no disponible, usando misiones de arranque:', gscErr?.message || gscErr);
      const starter = await buildStarterMissions(cleanSiteUrl, cleanGoldKeyword, cleanGoal);
      return { success: true, data: starter, source: 'web' };
    }

    if (!rows || rows.length === 0) {
      const starter = await buildStarterMissions(cleanSiteUrl, cleanGoldKeyword, cleanGoal);
      return { success: true, data: starter, source: 'web' };
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

    // Páginas ya optimizadas — no volver a pedir tareas en la misma URL (ni por slug)
    const completedPagePaths = new Set<string>();
    const completedPageSlugs = new Set<string>();
    if (session?.user?.email) {
      try {
        const doneMissions = await getMissionsByEmail(session.user.email, 'completed');
        for (const m of doneMissions) {
          if (m.target_url) {
            completedPagePaths.add(normalizePagePath(m.target_url));
            const slug = pathSlug(m.target_url);
            if (slug) completedPageSlugs.add(slug);
          }
        }
      } catch (err) {
        console.warn('[getRealMissions] No se pudieron cargar misiones completadas:', err);
      }
    }

    const isPageCompleted = (pageUrl: string): boolean => {
      const norm = normalizePagePath(pageUrl);
      if (completedPagePaths.has(norm)) return true;
      const slug = pathSlug(pageUrl);
      return !!(slug && completedPageSlugs.has(slug));
    };

    const brandTokens = deriveBrandTokens(cleanSiteUrl);

    const buildMissionsFromGscRows = (inputRows: typeof missionRows): any[] => {
      const rowsByPage = new Map<string, typeof missionRows>();
      for (const row of inputRows) {
        const pagePath = normalizePagePath(row.keys[0]);
        if (isPageCompleted(row.keys[0])) continue;
        const list = rowsByPage.get(pagePath) || [];
        list.push(row);
        rowsByPage.set(pagePath, list);
      }

      const built: any[] = [];

      for (const [pagePath, pageRows] of rowsByPage) {
        const candidates = pageRows
          .map(r => {
            const kw = cleanGscKeyword(r.keys[1] || '');
            let score = opportunityScore(r);
            if (isMostlySiteBrand(kw, brandTokens)) score *= 0.25;
            return { row: r, kw, score, isQuestion: isQuestionQuery(kw) };
          })
          .filter(c => c.kw.length > 0);

        const commercial = candidates.filter(c => !c.isQuestion).sort((a, b) => b.score - a.score);
        const questions  = candidates.filter(c => c.isQuestion).sort((a, b) => b.score - a.score);
        const bestCommercial = commercial[0];
        const bestQuestion   = questions[0];

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

        built.push({
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
          source: 'gsc',
        });
      }

      built.sort((a, b) => (b.opportunity || 0) - (a.opportunity || 0));
      return built;
    };

    let missions = buildMissionsFromGscRows(missionRows);

    // Si ya optimizaste el top de GSC, ampliar el pool (más filas, sin filtro de keyword)
    if (missions.length < 5 && session?.accessToken) {
      try {
        const broaderRows = await getSearchConsoleData(
          session.accessToken,
          cleanSiteUrl,
          undefined,
          250
        );
        if (broaderRows?.length) {
          const broaderMissionRows = sortGscRows(broaderRows).filter(
            (row) => !isHomeUrl(row.keys[0])
          );
          const seen = new Set(
            missionRows.map((r) => `${normalizePagePath(r.keys[0])}|${r.keys[1] || ''}`)
          );
          const merged = [...missionRows];
          for (const row of broaderMissionRows) {
            const key = `${normalizePagePath(row.keys[0])}|${row.keys[1] || ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              merged.push(row);
            }
          }
          missions = buildMissionsFromGscRows(merged);
          console.log(
            `[getRealMissions] Pool ampliado: ${merged.length} filas GSC → ${missions.length} misiones nuevas`
          );
        }
      } catch (err) {
        console.warn('[getRealMissions] No se pudo ampliar pool GSC:', err);
      }
    }

    // Si GSC no produjo ninguna misión útil, caemos a misiones de arranque.
    if (missions.length === 0) {
      const starter = await buildStarterMissions(cleanSiteUrl, cleanGoldKeyword, cleanGoal);
      const starterPending = starter.filter((m) => {
        const page = m.pagePath || m.page;
        return page && !isPageCompleted(String(page));
      });
      return {
        success: true,
        data: starterPending.length > 0 ? starterPending : starter,
        source: 'web',
      };
    }

    return { success: true, data: missions.slice(0, 20), source: 'gsc' }
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

// extractFromHtml y normalize viven en ./pageContent

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
// inferNichoFromUrl vive en ./pageContent

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

  const apiKey = readGeminiApiKey();
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
  let pageSlug = '';
  try {
    const u = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    brand = new URL(u).hostname.replace(/^www\./, '');
  } catch { /* keep raw */ }
  try {
    const pu = pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`;
    const p = new URL(pu).pathname.replace(/\/+$/, '');
    isHomepage = p === '' || p === '/';
    // Último segmento de la ruta: palabras que Google ya lee en la dirección.
    pageSlug = (p.split('/').pop() || '').replace(/[-_]+/g, ' ').trim();
  } catch { /* assume internal */ }

  const isTitle = missionType === 'H1';

  const cacheKey = buildGeminiCacheKey([
    'title_suggestion_v6',
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
      const parsed = parseTitleSuggestionFromGemini(cachedEarly);
      if (parsed) {
        const brandHints = extractBrandHints(currentValue, pageTitle, pageH1, brand);
        const suggestedTitle = isTitle
          ? fitSeoTitle(parsed.suggestedTitle, { brandHints })
          : parsed.suggestedTitle.slice(0, 155).trim();
        return {
          success: true as const,
          suggestedTitle,
          reason: parsed.reason,
          fromCache: true as const,
          fromAi: true as const,
        };
      }
    }
  } catch { /* si el cache está corrupto, seguimos y regeneramos */ }

  // Contexto del negocio: leemos la PORTADA solo si no tenemos ya contenido de la página
  // (el cliente ya envía título/H1/descripción del scraper en vivo — evita +4s y timeouts en Vercel).
  let businessContext = '';
  const hasPageContent = !!(pageTitle || pageH1 || pageDescription);
  if (!isHomepage && siteUrl && !hasPageContent) {
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

  // Qué cubren YA los otros campos: el título, la meta y el slug funcionan como un
  // conjunto. La IA debe complementarlos, no repetir lo que ya está dicho ahí.
  const siblingFields = [
    pageSlug && `  • Slug de la URL (Google ya lo lee): "${pageSlug}"`,
    isTitle
      ? (pageDescription && `  • Meta descripción actual (el campo que NO estás editando): "${pageDescription}"`)
      : (pageTitle && `  • Título actual (el campo que NO estás editando): "${pageTitle}"`),
  ].filter(Boolean).join('\n');

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
    ? `\nMARCAS QUE EL DUEÑO DECLARÓ QUE VENDE/DISTRIBUYE (fuente confiable, priorizá estas):\n  ${brands}\n  → Esto confirma que el negocio es MULTIMARCA. Podés usar estas marcas en el título/meta si son relevantes para esta página, SIEMPRE que no estén ya cubiertas en el slug o en el otro campo (regla de complementariedad).`
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
${siblingFields ? `\nQUÉ CUBREN YA LOS OTROS CAMPOS DE ESTA PÁGINA (título, meta y slug trabajan en equipo — NO repitas lo que ya está dicho acá):\n${siblingFields}` : ''}
CÓMO LE VA HOY EN GOOGLE (usá esto para decidir cuán agresivo ser):
${metricsBlock}

CAMPO A OPTIMIZAR: ${isTitle ? 'el TÍTULO SEO (etiqueta <title>)' : 'la META DESCRIPCIÓN'}
Valor actual de ese campo: "${currentValue || '(vacío)'}"${isTitle && currentValue && currentValue.length <= MAX_SEO_TITLE_LENGTH ? `\n⚠️ El título actual ya tiene ${currentValue.length} caracteres (zona VERDE en Yoast/Rank Math). Tu sugerencia DEBE quedar también en verde (máx. 60). NO agregues el nombre de la tienda si eso lo pasa a rojo.` : ''}
${goalGuidance ? `\nOBJETIVO PRINCIPAL DEL DUEÑO (orientá la estrategia hacia esto):\n  ${goalGuidance}` : ''}
PASO 1 — IDENTIFICÁ EL PERFIL DE MARCA DEL NEGOCIO (clave para decidir bien):
- MONOMARCA / producto puntual: el negocio vende su propia marca o esta es la página de un solo producto/marca. Señales: una sola marca repetida, página de ficha de producto único.
- MULTIMARCA / distribuidor / tienda que vende muchas marcas. Señales: palabras como "distribuidor", "multimarca", "todas las marcas", "importador", o varios nombres de marcas distintas en el contexto del negocio o la página. Muchos rubros funcionan así (tiendas de detailing, ferreterías, perfumerías, tecnología, repuestos, etc.).

PASO 2 — GENERÁ ${isTitle ? 'el TÍTULO SEO' : 'la META DESCRIPCIÓN'} aplicando las reglas según el perfil.

REGLAS ABSOLUTAS (un experto nunca las rompe):
1. COHERENCIA DE RUBRO ANTE TODO: nunca menciones productos, marcas o categorías de OTRO rubro. Una tienda de car detailing jamás habla de zapatillas; una perfumería jamás de herramientas.
2. SEGÚN EL PERFIL DE MARCA:
   - Si es MONOMARCA / producto puntual: trabajá SOLO con lo que la página realmente vende. No inventes marcas ajenas.
   - Si es MULTIMARCA / distribuidor: PODÉS incorporar estratégicamente nombres de marcas reconocidas y categorías del MISMO rubro para capturar más búsquedas —incluso marcas que vende la competencia—, porque una tienda multimarca legítimamente atrae ese tráfico. Priorizá SIEMPRE las marcas que el dueño declaró (si las hay arriba) y las que el negocio muestra que distribuye; si sumás una marca reconocida del rubro como jugada de captación, hacelo de forma honesta (como parte del catálogo o en comparación), SIN afirmar ser la marca oficial.
   - PERO ANTES DE SUMAR UNA MARCA, aplicá la regla 4 (complementariedad): si esa marca ya aparece en el slug de la URL o en el otro campo (meta/título), repetirla NO suma posicionamiento — usá ese espacio para un diferencial o término de intención.
3. PRESERVÁ LA INTENCIÓN DE BÚSQUEDA: nunca elimines la palabra que describe QUÉ es el producto/servicio ni los términos específicos de alta conversión (nombres de partes como "parabrisas", "paragolpes"; el problema que resuelve; el tipo exacto de producto). Si el texto actual tiene un término específico que la gente busca, CONSERVALO.
4. COMPLEMENTARIEDAD ENTRE CAMPOS: el título, la meta descripción y el slug de la URL forman UN CONJUNTO que Google lee completo. Cada campo debe aportar algo distinto:
   - Si una marca o frase YA está cubierta en el slug o en el otro campo (mirá el bloque "QUÉ CUBREN YA LOS OTROS CAMPOS"), NO la repitas: es espacio desperdiciado.
   - ${isTitle ? 'El TÍTULO lleva la intención principal + el diferencial del negocio. La marca de producto va en el título SOLO si no está ya en el slug/meta y captura búsquedas propias.' : 'La META nunca debe ser una copia del título: complementalo con el beneficio concreto, una marca o dato que el título no dijo, y un llamado a la acción.'}
5. PRESERVÁ LOS DIFERENCIALES COMPETITIVOS: frases que distinguen al negocio de la competencia ("importación directa", "fabricantes", "envío a todo el país", "precios mayoristas", "atención 24hs", años de trayectoria) valen MÁS que repetir una marca ya cubierta en otro campo. NUNCA elimines un diferencial presente en el texto actual para hacer lugar a una marca redundante; si el espacio no alcanza, el diferencial gana.
6. ${isHomepage ? 'ES LA PÁGINA DE INICIO: optimizá para la MARCA + la CATEGORÍA GLOBAL del negocio (ej: "Tienda de Car Detailing"), NUNCA para un producto puntual.' : 'ES UNA PÁGINA INTERNA: optimizá para el producto/servicio específico de esta página, no para la marca genérica.'}
7. USÁ LA POSICIÓN: si ya está en página 1, hacé cambios conservadores (no arruines lo que funciona); si está en página 2 o más lejos, podés ser más agresivo.
8. ELIMINÁ EL RUIDO: sacá gramaje, stock, tamaños y SKUs ("x 50gs/100gs", "500ml", "pack x12") y relleno vacío ("puro", "premium", "original") solo si hace falta para entrar en el límite.
9. DESDUPLICÁ SINÓNIMOS: si hay dos palabras casi iguales ("vidrios" y "cristales"), quedate con la más buscada/específica.
10. NUNCA dejes un título "pelado" tipo "Marca | Tienda". Siempre debe quedar claro qué se vende.
11. ${isTitle ? 'LONGITUD CRÍTICA (Yoast/Rank Math): NUNCA superes 60 caracteres — por encima queda en ROJO y empeora el SEO. Ideal 50-60. El nombre de la tienda al final es OPCIONAL: omitilo si no entra sin pasar a rojo, o si el H1/meta ya cubren la marca. Estructura sugerida: [qué es + intención] + [diferencial] + [tienda solo si hay espacio].' : 'LONGITUD: máximo 155 caracteres. Incluí la palabra clave de intención y un llamado a la acción claro ("Comprá", "Pedí presupuesto", "Conocé más").'}
12. Español rioplatense, natural, sin tecnicismos SEO.
${goalGuidance ? '13. RESPETÁ EL OBJETIVO DEL DUEÑO descrito arriba al elegir el enfoque del texto.' : ''}

ANTES DE RESPONDER, AUTO-VERIFICÁ tu sugerencia como un consultor que revisa su trabajo:
  a) ¿Repetí una marca o frase que ya está en el slug o en el otro campo? → Reemplazala por un diferencial o término de intención.
  b) ¿Eliminé un diferencial competitivo que estaba en el texto actual? → Restauralo.
  c) ¿Se entiende QUÉ vende la página sin ver el resto del sitio? → Si no, corregilo.

En "reason", explicale al dueño en una frase qué decidiste y por qué, relacionando las variables. Si sumaste una marca por ser multimarca, decilo; si NO sumaste una marca declarada porque ya estaba cubierta en el slug o la meta, también decilo (ej: "No repetí Black Line en el título porque ya está en la dirección y la descripción; prioricé tu diferencial de importación directa").

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

    const parsed = parseTitleSuggestionFromGemini(result.text);
    if (!parsed) {
      console.warn('[getSmartMissionSuggestion] JSON inválido:', result.text.substring(0, 200));
      return { success: false, fallback: true as const, credits: result.credits };
    }

    const brandHints = extractBrandHints(currentValue, pageTitle, pageH1, brand, businessContext);
    const suggestedTitle = isTitle
      ? fitSeoTitle(parsed.suggestedTitle, { brandHints })
      : parsed.suggestedTitle.slice(0, 155).trim();

    return {
      success: true as const,
      suggestedTitle,
      reason: parsed.reason,
      fromAi: true as const,
      credits: result.credits,
    };
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

  // Hard timeout: Quick Wins = GSC + scrape (3 URLs) + Gemini — needs headroom on Vercel
  const timeoutPromise = new Promise<{ success: false; error: string; code: string }>((resolve) =>
    setTimeout(() => resolve({ success: false, error: "El análisis tardó demasiado. Tocá Reintentar.", code: 'TIMEOUT' }), 55000)
  );

  return Promise.race([
    _getQuickWinsCore(cleanSiteUrl, cleanGoldKeyword, excludeList, cleanBusinessFocus),
    timeoutPromise,
  ]);
}

/** Fallback when Gemini is slow/unavailable — keeps Quick Wins usable with GSC data. */
function buildQuickWinsFallback(opportunities: any[]): any[] {
  return opportunities.slice(0, 3).map((opp) => {
    const kw = opp.keyword || 'tu producto';
    const pos = typeof opp.position === 'number' ? Math.round(opp.position) : 10;
    const brand = (opp.currentTitle || '').split('|')[0].trim();
    const suggestedTitle = brand
      ? `${kw} | ${brand}`.slice(0, 60)
      : `${kw} — Comprá Online`.slice(0, 60);
    return {
      page: opp.page,
      keyword: opp.keyword,
      clicks: opp.clicks,
      impressions: opp.impressions,
      position: opp.position,
      currentTitle: opp.currentTitle || '',
      suggestedTitle,
      explanation: `Esta página está en posición ${pos} con ${opp.impressions || 0} impresiones. Un título más claro y comercial puede empujarla al Top 3.`,
      pageType: opp.pageType || '',
      source: 'fallback',
    };
  });
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
    try {
      inferredNicho = inferNichoFromUrl(cleanSiteUrl);
    } catch (e) {
      console.warn("Error infiriendo nicho para Quick Wins:", e);
    }

    let isMockData = false;
    let homeMeta: { title: string; description: string; h1: string; pageType?: string } = { title: "", description: "", h1: "", pageType: "" };
    let gscRows: any[] = [];

    // Home scrape + GSC in parallel (saves ~3-4s vs sequential)
    const GSC_QUICK_WINS_LIMIT = 40;
    const GSC_FETCH_MS = 14000;

    const gscPromise = session?.accessToken
      ? getSearchConsoleData(
          session.accessToken,
          cleanSiteUrl,
          cleanGoldKeyword || undefined,
          GSC_QUICK_WINS_LIMIT,
          { fastMode: true }
        ).catch((err: any) => {
          console.warn("Fallo al obtener datos de GSC para Quick Wins:", err.message);
          return null;
        })
      : Promise.resolve(null);

    const gscTimeout = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('[QuickWins] GSC superó el límite de tiempo, continuando sin datos GSC');
        resolve(null);
      }, GSC_FETCH_MS)
    );

    const [scrapedHome, fetchedGsc] = await Promise.all([
      scrapeMetadata(cleanSiteUrl).catch(() => ({ title: '', description: '', h1: '', pageType: '' })),
      Promise.race([gscPromise, gscTimeout]),
    ]);
    homeMeta = scrapedHome;
    if (fetchedGsc === null) {
      isMockData = true;
    } else if (!session?.accessToken) {
      isMockData = true;
    } else {
      gscRows = fetchedGsc;
    }

    const businessNiche = [inferredNicho, homeMeta.title, homeMeta.description, homeMeta.h1]
      .filter(Boolean)
      .join(" | ") || "Nicho de negocio general";

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
      excludePages.map(p => normalizePagePath(p).toLowerCase())
    );

    // No volver a sugerir páginas ya trabajadas (Quick Win, H1, etc.) en Supabase
    if (session?.user?.email) {
      try {
        const doneMissions = await getMissionsByEmail(session.user.email, 'completed');
        for (const m of doneMissions) {
          if (m.target_url) {
            excludeNorm.add(normalizePagePath(m.target_url).toLowerCase());
          }
        }
      } catch (err) {
        console.warn('[QuickWins] No se pudieron cargar misiones completadas:', err);
      }
    }

    // Hasta 3 candidatos, excluyendo páginas que el usuario descartó
    const validCandidates: any[] = Array.from(urlToBestCand.values())
      .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
      .filter(c => !excludeNorm.has(normalizePagePath(c.keys[0] || '').toLowerCase()))
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
        scrapeMetadata(cand.keys[0]).catch(() => ({ title: '', description: '', h1: '', pageType: '' }))
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
      pageType: candidateMetas[i].pageType || '',
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
          return scrapeMetadata(cleanSiteUrl.replace(/\/$/, '') + t.path).catch(() => ({ title: '', description: '', h1: '', pageType: '' }));
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
          pageType: fallbackMetas[i].pageType || (isHomePage(pageUrl, cleanSiteUrl) ? 'home' : ''),
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
- Máximo ABSOLUTO: 60 caracteres. Por encima, Yoast/Rank Math lo marcan en ROJO y empeora el SEO. Google también lo cortará con "...".
- Si el "currentTitle" ya tiene ≤60 caracteres (ya está en verde), tu sugerencia TAMBIÉN debe quedar ≤60. NO agregues el nombre de la tienda al final si eso lo pasa a rojo.
- Contá los caracteres mentalmente antes de escribir el título. Si tu primer borrador tiene 70 caracteres, comprimilo o sacá la marca de la tienda.
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

██████████████████████████████████████████████████████████████
⚠️  REGLA ABSOLUTA #6 — COMPLEMENTARIEDAD Y DIFERENCIALES ⚠️
██████████████████████████████████████████████████████████████
El título, la meta descripción ("currentDescription") y la URL de cada página forman UN CONJUNTO que Google lee completo. Antes de escribir cada "suggestedTitle":
- Mirá la URL y la "currentDescription" de esa oportunidad: si una MARCA o el NOMBRE DE LA TIENDA ya aparece ahí, NO lo repitas en el título — es espacio desperdiciado. Usá ese espacio para el término de intención o un diferencial.
- ESTA REGLA APLICA SOLO A MARCAS Y NOMBRES DE TIENDA. NUNCA apliques esta regla a términos descriptivos del producto o de cómo la gente lo busca: que una palabra aparezca en el slug de la URL NO significa que esté "cubierta" — la URL no reemplaza al título. Ejemplo INVÁLIDO: quitar "acople" del título de una Foam Lance porque el slug es "/foam-lance-acople-adaptador/" (la gente busca "foam lance con acople"; sacarlo pierde esa búsqueda). Ejemplo VÁLIDO: no repetir "55detailshop" si ya está en la descripción.
- PRESERVÁ LOS DIFERENCIALES COMPETITIVOS del título actual ("importación directa", "fabricantes", "envío a todo el país", "precios mayoristas", años de trayectoria): valen MÁS que repetir una marca ya cubierta en otro campo. Si el espacio no alcanza, el diferencial gana sobre la marca redundante.
🔒 VIOLACIÓN = título redundante que no suma posicionamiento nuevo.
██████████████████████████████████████████████████████████████

██████████████████████████████████████████████████████████████
⚠️  REGLA ABSOLUTA #7 — NO BORRAR TÉRMINOS DE BÚSQUEDA DEL TÍTULO ACTUAL ⚠️
██████████████████████████████████████████████████████████████
El título actual ("currentTitle") suele contener palabras que el dueño puso porque SABE cómo lo buscan sus clientes (complementos, compatibilidades, formatos: "con acople", "para hidrolavadora", "x 1 litro", "kit", "por mayor").
- Antes de eliminar cualquier palabra descriptiva del título actual, preguntate: "¿alguien podría incluir esta palabra al buscar este producto?". Si la respuesta es sí o probablemente, CONSERVALA.
- NUNCA reemplaces un término específico y buscable por una etiqueta genérica de categoría. Ejemplo INVÁLIDO: reemplazar "acople" por "Accesorio Detailing" ("accesorio detailing" es genérico; "foam lance con acople" es lo que se busca).
- Podés eliminar sin miedo: relleno sin intención ("calidad premium", "increíble"), marca de la tienda duplicada, y datos de stock/gramaje irrelevantes para la búsqueda.
🔒 VIOLACIÓN = la página pierde las búsquedas reales que ya tenía ganadas.
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
      'quick_wins_v3',
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
      console.warn('[QuickWins] Gemini falló, usando fallback con datos GSC:', geminiResult.error);
      const fallbackWins = buildQuickWinsFallback(opportunities);
      if (fallbackWins.length > 0) {
        return { success: true, quickWins: fallbackWins, isMockData, fromFallback: true };
      }
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
      const fallbackWins = buildQuickWinsFallback(opportunities);
      if (fallbackWins.length > 0) {
        return { success: true, quickWins: fallbackWins, isMockData, fromFallback: true };
      }
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

    // ── Reincorporar el tipo de página detectado desde el HTML ──
    // La IA no devuelve pageType; lo recuperamos de las oportunidades originales
    // por URL para que la guía "¿Dónde aplico esto?" mande al lugar correcto.
    const pageTypeByUrl = new Map<string, string>();
    for (const opp of opportunities) {
      if (opp.page) pageTypeByUrl.set(opp.page.replace(/\/$/, "").toLowerCase(), opp.pageType || '');
    }
    parsed = parsed.map((win: any) => {
      const key = (win.page || '').replace(/\/$/, "").toLowerCase();
      return { ...win, pageType: pageTypeByUrl.get(key) || '' };
    });

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
    const qwBrandHints = extractBrandHints(businessNiche, brandFallbackTitle, domainLabel);
    parsed = parsed.map((win: any) => {
      if (win.suggestedTitle) {
        const before = win.suggestedTitle;
        win.suggestedTitle = fitSeoTitle(win.suggestedTitle, {
          brandHints: extractBrandHints(win.currentTitle, ...qwBrandHints),
        });
        if (win.suggestedTitle.length < before.length) {
          console.warn(`[QuickWins L3] Title fitted from ${before.length} to ${win.suggestedTitle.length} chars: "${win.suggestedTitle}"`);
        }
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
        // Slugs ya trabajados (cualquier tipo de misión / quick win): reconoce la
        // misma página aunque la URL difiera en el prefijo (ej:
        // "/categoria-producto/pulidoras" vs "/pulidoras").
        const workedSlugs = new Set(
          doneMissions
            .map(m => pathSlug(m.target_url))
            .filter(Boolean)
        );
        if (doneQuickWinUrls.size > 0 || workedPagePaths.size > 0 || workedSlugs.size > 0) {
          parsed = parsed.filter((win: any) => {
            if (doneQuickWinUrls.has(win.page)) return false;
            if (workedPagePaths.has(normalizePagePath(win.page))) return false;
            const winSlug = pathSlug(win.page);
            if (winSlug && workedSlugs.has(winSlug)) return false;
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

    const contentPages = crawlData.pages.filter((p) => isContentPage(p.url));
    const hubPages = crawlData.pages.filter((p) => isCatalogHubPage(p.url, cleanSiteUrl));
    const contentPagesSummary = contentPages.length
      ? contentPages.map((p) => `- ${p.url} (título: "${p.title}")`).join('\n')
      : '(ninguna detectada en este crawl — no inventes URLs de blog)';
    const hubPagesSummary = hubPages.length
      ? hubPages.map((p) => `- ${p.url}`).join('\n')
      : '(ninguna)';

    // Ya filtrados en el crawl (sin catálogo/grillas WooCommerce); revalidar origen por URL.
    const genericAnchorsForPrompt = crawlData.genericAnchors.filter(
      (g) => isValidLinkSourcePage(g.page, cleanSiteUrl)
    );

    const brokenSummary = crawlData.brokenLinks.slice(0, 10).map(b =>
      `- En "${b.page}" → enlace roto: "${b.href}" (texto: "${b.anchorText}", error: ${b.statusCode})`
    ).join('\n');
    const genericSummary = genericAnchorsForPrompt.slice(0, 10).map(g =>
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

PÁGINAS DE CONTENIDO (PRIORIDAD para traspaso de fuerza — blog, guías, artículos):
${contentPagesSummary}

PÁGINAS CATÁLOGO/HUB (PROHIBIDO usar como origen de enlaces contextuales):
${hubPagesSummary}

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

REGLAS DE TRASPASO DE FUERZA (internalLinking) Y TEXTO DE ANCLAJE (anchorText):
- PROHIBIDO usar como página de ORIGEN (fromPage / page): la Home, /tienda, /productos, /categoria, /catalogo, /shop o cualquier página listada como CATÁLOGO/HUB arriba. En esas páginas meter anclas contextuales rompe el diseño del ecommerce.
- PRIORIZÁ como origen solo páginas de CONTENIDO (blog, guías, artículos informativos) donde un enlace de texto fluye natural en el cuerpo del texto.
- Si no hay páginas de contenido escaneadas para originar el enlace, devolvé "internalLinking": [] en vez de sugerir enlaces desde catálogo o home.
- Las páginas de destino (toPage) SÍ pueden ser categorías o productos que necesitan más visibilidad.
- En "anchorText", solo sugerí cambios en páginas de contenido, nunca en home ni catálogo.
`;

    const session = await auth();
    const userEmail = session?.user?.email || '';
    const isAdmin = await checkIsAdmin();
    if (!userEmail && !isAdmin) {
      return { success: false, error: 'Tenés que iniciar sesión para usar el Detective con IA.', code: 'NOT_AUTHENTICATED' };
    }

    const cacheKey = buildGeminiCacheKey([
      'detective_enlaces_v2',
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

    const internalLinking = filterInternalLinkingRecs(
      Array.isArray(parsed.internalLinking) ? parsed.internalLinking : [],
      cleanSiteUrl
    ).slice(0, 5);
    const anchorText = filterAnchorTextRecs(
      Array.isArray(parsed.anchorText) ? parsed.anchorText : [],
      cleanSiteUrl
    ).slice(0, 5);

    return {
      success: true,
      audit: {
        internalLinking,
        brokenLinks: Array.isArray(parsed.brokenLinks) ? parsed.brokenLinks.slice(0, 5) : [],
        anchorText,
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
  suggestedValue?: string,
  baseline?: {
    keyword?: string;
    position?: number;
    clicks?: number;
    impressions?: number;
  }
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false };
  }
  const baselineInput: MissionBaselineInput | undefined = baseline
    ? {
        gold_keyword: baseline.keyword ?? null,
        baseline_position: typeof baseline.position === 'number' ? baseline.position : null,
        baseline_clicks: typeof baseline.clicks === 'number' ? Math.round(baseline.clicks) : null,
        baseline_impressions: typeof baseline.impressions === 'number' ? Math.round(baseline.impressions) : null,
      }
    : undefined;
  const result = await completeMission(
    session.user.email,
    missionType,
    targetUrl,
    xpAwarded,
    suggestedValue,
    baselineInput
  );
  return { success: !!result };
}

/**
 * Compara misiones completadas (≥7 días) con GSC actual y devuelve victorias SEO.
 */
export async function checkSeoWins(siteUrl: string): Promise<{
  success: boolean;
  wins: { missionId: string; message: string }[];
}> {
  const session = await auth();
  if (!session?.user?.email || !session.accessToken || !siteUrl?.trim()) {
    return { success: false, wins: [] };
  }

  let pending;
  try {
    pending = await getMissionsPendingSeoWinCheck(session.user.email, 7, 5);
  } catch (err) {
    console.warn('[checkSeoWins] Error cargando misiones:', err);
    return { success: false, wins: [] };
  }

  if (!pending.length) {
    return { success: true, wins: [] };
  }

  const wins: { missionId: string; message: string }[] = [];
  const cleanSite = siteUrl.trim();

  for (const mission of pending) {
    try {
      const current = await getPageQueryMetrics(
        session.accessToken as string,
        cleanSite,
        mission.target_url,
        mission.gold_keyword || undefined
      );
      if (!current) continue;

      const win = detectSeoWin(
        {
          position: mission.baseline_position ?? undefined,
          clicks: mission.baseline_clicks ?? undefined,
          impressions: mission.baseline_impressions ?? undefined,
        },
        current
      );
      if (!win) continue;

      wins.push({
        missionId: mission.id,
        message: buildSeoWinMessage(mission, win),
      });
      await markMissionWinNotified(mission.id);
    } catch (err) {
      console.warn('[checkSeoWins] Error en misión', mission.id, err);
    }
  }

  return { success: true, wins };
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
  // Hard timeout: never hang more than 35 seconds
  const timeoutPromise = new Promise<{ success: false; error: string; code: string }>((resolve) =>
    setTimeout(() => resolve({ success: false, error: "El análisis AEO tardó demasiado. Tocá Reintentar.", code: 'TIMEOUT' }), 35000)
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

/**
 * Generates 2 generic AEO starter opportunities when no H2/H3 sections are found on the site.
 * These guide users to add the minimal content structures that AI models look for.
 */
function buildAeoStarterOpportunities(
  siteUrl: string,
  goldKeyword: string,
  businessFocus: string
): any[] {
  const topic = goldKeyword || businessFocus || siteUrl.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  const topicCap = cap(topic);
  const homeUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;

  return [
    {
      is_opportunity: true,
      section_index: 0,
      heading_affected: `¿Qué es ${topicCap}?`,
      heading_tag: 'H2',
      current_text_snippet: '(sección no encontrada en tu web)',
      problem_identified: `Tu web no tiene una sección que responda directamente "¿Qué es ${topicCap}?". ChatGPT, Perplexity y Google AI buscan ese bloque para citarte como fuente.`,
      optimized_text_replacement: `${topicCap} es [describí en 1 oración qué es exactamente lo que ofrecés]. [Agregá 1 dato concreto: tiempo, precio, resultado o diferencial]. Ideal para [perfil de tu cliente ideal].`,
      word_count: 35,
      pageUrl: homeUrl,
      source: 'starter',
    },
    {
      is_opportunity: true,
      section_index: 1,
      heading_affected: `¿Para quién es ${topicCap}?`,
      heading_tag: 'H2',
      current_text_snippet: '(sección no encontrada en tu web)',
      problem_identified: `Sin una sección que defina tu cliente ideal, la IA no puede recomendar tu negocio en respuestas dirigidas. Es el segundo bloque más buscado por los modelos de IA.`,
      optimized_text_replacement: `${topicCap} está pensado para [describí el perfil: tipo de persona, empresa o situación]. Si [describí el problema que resolvés] y buscás [resultado que obtenés], esta es la solución indicada.`,
      word_count: 38,
      pageUrl: homeUrl,
      source: 'starter',
    },
  ];
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
      const starters = buildAeoStarterOpportunities(
        cleanSiteUrl,
        cleanGoldKeyword,
        businessFocus
      );
      return { success: true, data: starters };
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

IMPORTANTE — NO son oportunidades AEO (marcá is_opportunity = false SIEMPRE):
- Encabezados de NAVEGACIÓN o secciones de tienda: "Últimos ingresos", "Novedades", "Destacados", "Más vendidos", "Ofertas", "Productos relacionados", "Categorías", "Marcas", "Carrito", "Envíos", "Colecciones". Son listados/carruseles de productos, no preguntas informativas. NO se responden con un párrafo; su función es mostrar productos.
- Textos que son botones o interfaz: "Añadir al carrito", "Vista rápida", "Agregar a la lista de deseos", "Comprar ahora", precios sueltos, nombres de producto en serie.
- Una oportunidad AEO REAL es un encabezado que plantea una PREGUNTA o CONCEPTO informativo ("¿Qué es...?", "¿Cómo...?", "¿Cuánto dura...?", "Beneficios de...") cuyo párrafo debería dar una respuesta directa.

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
      'aeo_v3',
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

    // ── SEGUNDA RED: descartar encabezados de navegación / textos de interfaz ──
    // scrapeHeadingSections ya filtra antes de la IA, pero esta capa atrapa lo
    // que se cuele igual (o resultados cacheados de antes del filtro): carruseles
    // tipo «Últimos ingresos», «Destacados», y textos de UI («Añadir al carrito»,
    // «Vista rápida»). Estos NO son preguntas informativas y no sirven para AEO.
    opportunities = opportunities.filter((opp: any) => {
      const heading = opp.heading_affected || '';
      const snippet = opp.current_text_snippet || '';
      if (opp.source === 'starter') return true; // los starters son plantillas válidas
      if (isUiNavigationHeading(heading)) {
        console.log(`[AEO] Descartada oportunidad de navegación/UI: heading "${heading}"`);
        return false;
      }
      if (snippet && isUiNoiseText(snippet)) {
        console.log(`[AEO] Descartada oportunidad por texto de interfaz bajo "${heading}"`);
        return false;
      }
      return true;
    });

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

// ════════════════════════════════════════════════════════════════════════════
// ESPÍA DE LA COMPETENCIA (Fase 1 — on-demand)
// Compara la web del usuario con la de un rival y detecta brechas accionables.
// Guarda un snapshot por rival para detección de cambios al volver a espiar.
// ════════════════════════════════════════════════════════════════════════════

type SpyGap = SpyGapEnriched;

type SpyChange = {
  field: string;
  before: string;
  after: string;
};

/** Compara dos snapshots y devuelve los cambios significativos (título/H1/headings/FAQ). */
function diffSnapshots(prev: CompetitorSnapshot, next: CompetitorSnapshot): SpyChange[] {
  const changes: SpyChange[] = [];

  if (prev.title && next.title && prev.title.trim() !== next.title.trim()) {
    changes.push({ field: 'Título (SEO)', before: prev.title, after: next.title });
  }
  if (prev.h1 && next.h1 && prev.h1.trim() !== next.h1.trim()) {
    changes.push({ field: 'Encabezado H1', before: prev.h1, after: next.h1 });
  }

  const prevSet = new Set((prev.headings || []).map((h) => h.trim().toLowerCase()));
  const newHeadings = (next.headings || []).filter((h) => !prevSet.has(h.trim().toLowerCase()));
  if (newHeadings.length > 0) {
    changes.push({
      field: 'Contenido nuevo',
      before: `${prev.headings?.length || 0} secciones`,
      after: `Sumó: ${newHeadings.slice(0, 3).join(' · ')}`,
    });
  }

  const prevFaqs = new Set((prev.faqQuestions || []).map((q) => q.trim().toLowerCase()));
  const newFaqs = (next.faqQuestions || []).filter((q) => !prevFaqs.has(q.trim().toLowerCase()));
  if (newFaqs.length > 0) {
    changes.push({
      field: 'Preguntas / FAQ',
      before: `${prev.faqQuestions?.length || 0} preguntas`,
      after: `Sumó: ${newFaqs.slice(0, 3).join(' · ')}`,
    });
  }

  if (!!prev.hasFaqSchema !== !!next.hasFaqSchema) {
    changes.push({
      field: 'Schema FAQ',
      before: prev.hasFaqSchema ? 'Tenía FAQPage' : 'Sin FAQPage',
      after: next.hasFaqSchema ? 'Ahora tiene FAQPage' : 'Sacó FAQPage',
    });
  }

  return changes;
}

/**
 * Busca en Search Console la página propia que mejor rankea para una keyword.
 * Devuelve la URL (preferentemente una página interna, no la home) o null.
 */
async function findOwnPageForKeyword(
  accessToken: string,
  ownSiteUrl: string,
  keyword: string
): Promise<string | null> {
  try {
    const rows = await getSearchConsoleData(accessToken, ownSiteUrl, keyword, 5);
    if (!Array.isArray(rows) || rows.length === 0) return null;
    // Dimensiones [page, query] → keys[0] = URL de la página.
    const pages = rows
      .map((r: any) => (Array.isArray(r.keys) ? r.keys[0] : null))
      .filter((u: any): u is string => typeof u === 'string' && u.length > 0);
    if (pages.length === 0) return null;
    const nonHome = pages.find((u) => {
      try { return new URL(u).pathname.replace(/\/+$/, '') !== ''; } catch { return false; }
    });
    return nonHome || pages[0];
  } catch (err) {
    console.warn('[findOwnPageForKeyword] error:', err);
    return null;
  }
}

/**
 * Espía on-demand a un competidor: scrapea su web, la compara con la del usuario
 * vía Gemini y devuelve brechas accionables. Detecta cambios si ya se había espiado antes.
 */
export async function spyCompetitor(competitorUrl: string, ownSiteUrl: string, goldKeyword?: string, ownComparisonUrl?: string) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  const userEmail = (session?.user?.email || '').toLowerCase().trim();
  const isAdmin = await checkIsAdmin();
  if (!userEmail && !isAdmin) {
    return { success: false, error: 'Tenés que iniciar sesión para usar el Espía.', code: 'NOT_AUTHENTICATED' };
  }

  // ── Validación de URLs ──────────────────────────────────────────────────────
  const rivalSanit = sanitizeInput(competitorUrl, 'url');
  if (!rivalSanit.isValid) {
    return { success: false, error: rivalSanit.error || 'La URL del competidor no es válida.' };
  }
  let rivalUrl = rivalSanit.sanitized;
  if (!rivalUrl.startsWith('http://') && !rivalUrl.startsWith('https://')) {
    rivalUrl = 'https://' + rivalUrl;
  }

  let ownUrl = (ownSiteUrl || '').trim();
  if (ownUrl && !ownUrl.startsWith('http://') && !ownUrl.startsWith('https://')) {
    ownUrl = 'https://' + ownUrl;
  }

  // Página propia equivalente (opcional): si el usuario la pega, comparamos
  // manzana-con-manzana (producto vs producto) en vez de su home vs el producto rival.
  let ownComparison = (ownComparisonUrl || '').trim();
  if (ownComparison) {
    const cmpSanit = sanitizeInput(ownComparison, 'url');
    if (cmpSanit.isValid) {
      ownComparison = cmpSanit.sanitized;
      if (!ownComparison.startsWith('http://') && !ownComparison.startsWith('https://')) {
        ownComparison = 'https://' + ownComparison;
      }
    } else {
      ownComparison = '';
    }
  }
  // Helpers de clasificación de URL (home vs página específica).
  const isHomeUrl = (u: string): boolean => {
    try { return new URL(u).pathname.replace(/\/+$/, '') === ''; } catch { return false; }
  };
  const isSpecificUrl = (u: string): boolean => {
    try { return new URL(u).pathname.replace(/\/+$/, '').split('/').filter(Boolean).length >= 1; } catch { return false; }
  };

  // URL propia efectiva a comparar. Prioridad:
  //   1) la que el usuario pegó manualmente
  //   2) (más abajo) la que auto-detectamos en su Search Console
  //   3) su home como último recurso
  let effectiveOwnUrl = ownComparison || ownUrl;
  let autoMatchedOwnUrl = '';

  // No dejar que se espíe a sí mismo (no aporta nada).
  const sameHost = (a: string, b: string) => {
    try {
      return new URL(a).hostname.replace(/^www\./, '') === new URL(b).hostname.replace(/^www\./, '');
    } catch {
      return false;
    }
  };
  if (ownUrl && sameHost(rivalUrl, ownUrl)) {
    return { success: false, error: 'Esa es tu propia web. Ingresá la URL de un competidor.' };
  }

  // ── Límite de competidores por plan ─────────────────────────────────────────
  if (userEmail && !isAdmin) {
    try {
      const snapshot = await getUserPlanSnapshot(userEmail, { isAdmin });
      const limit = MAX_COMPETITORS_BY_PLAN[snapshot.plan] ?? 1;
      const existing = await listCompetitorUrls(userEmail);
      const alreadyTracked = existing.some((u) => u === rivalUrl);
      if (!alreadyTracked && existing.length >= limit) {
        return {
          success: false,
          upgrade: true,
          code: 'COMPETITOR_LIMIT',
          error: `Tu plan ${snapshot.planLabel} permite espiar ${limit} competidor${limit === 1 ? '' : 'es'}. Pasate a un plan superior para sumar más.`,
        };
      }
    } catch (err) {
      console.warn('[spyCompetitor] No se pudo verificar el límite de competidores:', err);
    }
  }

  // ── Scrape del rival ────────────────────────────────────────────────────────
  let rivalSnapshot: CompetitorSnapshot;
  try {
    rivalSnapshot = await buildCompetitorSnapshot(rivalUrl);
  } catch (err) {
    console.error('[spyCompetitor] Error scraping rival:', err);
    return { success: false, error: 'No pudimos leer la web del competidor. Verificá que la URL sea pública y esté online.' };
  }

  if (!rivalSnapshot.title && !rivalSnapshot.h1 && rivalSnapshot.headings.length === 0) {
    return { success: false, error: 'La web del competidor no devolvió contenido legible (puede bloquear bots o estar caída).' };
  }

  // ── Keyword/tema en juego (del usuario o derivado del rival) ────────────────
  let cleanKeyword = '';
  if (goldKeyword) {
    const kwSanit = sanitizeInput(goldKeyword, 'keyword');
    if (kwSanit.isValid) cleanKeyword = kwSanit.sanitized;
  }
  // Si no hay keyword, derivamos el tema desde el H1/título del rival.
  const effectiveKeyword =
    cleanKeyword || (rivalSnapshot.h1 || rivalSnapshot.title || '').trim().slice(0, 80);

  // ── Auto-detección de tu página equivalente vía Search Console ──────────────
  // Si NO pasaste una página propia y el rival es una página específica,
  // buscamos en tu GSC qué página tuya rankea para ese tema y comparamos ESA
  // (producto vs producto) en vez de tu home. Silencioso si no hay match.
  if (!ownComparison && session?.accessToken && isSpecificUrl(rivalUrl) && effectiveKeyword) {
    try {
      const found = await findOwnPageForKeyword(session.accessToken, ownUrl, effectiveKeyword);
      if (found && !isHomeUrl(found) && sameHost(found, ownUrl)) {
        autoMatchedOwnUrl = found;
        effectiveOwnUrl = found;
      }
    } catch (err) {
      console.warn('[spyCompetitor] Auto-match GSC falló:', err);
    }
  }

  // ── Snapshot propio (para comparar) ─────────────────────────────────────────
  let ownSnapshot: CompetitorSnapshot | null = null;
  if (effectiveOwnUrl) {
    try {
      ownSnapshot = await buildCompetitorSnapshot(effectiveOwnUrl);
    } catch {
      ownSnapshot = null;
    }
  }

  // Desajuste real: caímos a la home porque no hubo URL manual NI auto-match,
  // pero el rival es una página específica. Ahí la IA no debe penalizar generalidad.
  const pageTypeMismatch =
    !ownComparison && !autoMatchedOwnUrl && isSpecificUrl(rivalUrl) && isHomeUrl(effectiveOwnUrl);

  // ── Detección de cambios vs último espionaje ────────────────────────────────
  let changes: SpyChange[] = [];
  let firstTime = true;
  if (userEmail) {
    try {
      const prev = await getCompetitorSnapshot(userEmail, rivalUrl);
      if (prev) {
        firstTime = false;
        changes = diffSnapshots(prev, rivalSnapshot);
      }
    } catch (err) {
      console.warn('[spyCompetitor] No se pudo leer snapshot previo:', err);
    }
  }

  // ── Análisis de brechas con Gemini (consume crédito IA) ─────────────────────
  const apiKey = readGeminiApiKey();
  if (!apiKey) {
    return { success: false, error: 'GEMINI_API_KEY no configurada en el servidor.' };
  }

  const systemInstructions = `Sos un consultor SEO + AEO senior que ayuda a dueños de PyMES (sin conocimientos técnicos) a entender qué hace mejor su competencia y cómo superarla. Hablás en español rioplatense, claro y directo, sin jerga.

Te paso dos webs: la del USUARIO y la de un COMPETIDOR. Compará:
1) On-page SEO: título, H1, temas/encabezados.
2) Respuestas a preguntas (AEO): qué preguntas responde cada uno (FAQ visible) y si tiene Schema FAQPage / Product (lo que Google, ChatGPT y Gemini leen para citar).

Devolvé ESTRICTAMENTE un JSON (sin markdown) con esta forma:
{
  "verdict": "1 frase resumen honesta de quién está mejor parado y por qué (mencionar SEO y/o respuestas a preguntas si aplica)",
  "gaps": [
    {
      "area": "Título SEO" | "Encabezado H1" | "Contenido/Temas" | "Intención de búsqueda" | "Preguntas/FAQ" | "Schema AEO",
      "problem": "Qué hace mejor el competidor o qué le falta al usuario (concreto, 1-2 frases)",
      "suggestion": "Acción exacta que el usuario puede copiar/hacer hoy para cerrar la brecha"
    }
  ]
}

Reglas:
- Máximo 4 gaps, priorizando impacto. Si el rival responde preguntas que el usuario no, ESO es un gap de alta prioridad (área "Preguntas/FAQ"): listá 1-3 preguntas concretas que debería agregar.
- Si el rival tiene Schema FAQPage (o Product) y el usuario no, incluí un gap "Schema AEO" con acción clara (ej: "Agregá el bloque FAQPage con estas preguntas…").
- Si el usuario ya está mejor, devolvé menos gaps y un verdict positivo.
- No inventes datos que no estén en la info provista. Si no tenés la web del usuario, basá las sugerencias en buenas prácticas vs el competidor.
- Las sugerencias deben ser accionables y específicas (ej: "Cambiá tu H1 a 'X'" o "Agregá la pregunta '¿Cuánto dura el efecto?' con una respuesta de 2-3 frases"), nunca genéricas como "mejorá tu SEO".`;

  const mismatchNote = pageTypeMismatch
    ? `
ATENCIÓN — DESAJUSTE DE PÁGINAS: La web del USUARIO que recibís es su PÁGINA DE INICIO (home), que por naturaleza es general y representa la marca y todas las categorías. La del COMPETIDOR es una PÁGINA DE PRODUCTO ESPECÍFICA. NO penalices al usuario por ser "genérico" ni le digas que su título/H1 es demasiado amplio: en una home eso es correcto. La brecha REAL y tu sugerencia PRINCIPAL deben ser que el usuario probablemente NO tiene una página dedicada para este producto/búsqueda específica, y que para competirle debe CREAR u OPTIMIZAR una página de producto propia que ataque esa keyword. Compará la home solo a nivel marca/confianza, no producto contra producto.`
    : '';

  const packSnapshot = (s: CompetitorSnapshot) => ({
    title: s.title,
    h1: s.h1,
    headings: s.headings,
    faqQuestions: s.faqQuestions || [],
    hasFaqSchema: !!s.hasFaqSchema,
    schemaTypes: s.schemaTypes || [],
  });

  const userPrompt = `Tema/keyword en juego: "${effectiveKeyword || 'no especificada'}"
${mismatchNote}
WEB DEL USUARIO (${pageTypeMismatch ? 'PÁGINA DE INICIO / HOME' : effectiveOwnUrl || 'no disponible'}):
${ownSnapshot ? JSON.stringify(packSnapshot(ownSnapshot), null, 2) : '(no disponible — analizá solo al competidor y sugerí cómo competirle)'}

WEB DEL COMPETIDOR (${rivalUrl}):
${JSON.stringify(packSnapshot(rivalSnapshot), null, 2)}`;

  const cacheKey = buildGeminiCacheKey([
    'competitor_spy_v3_aeo',
    userEmail || 'dev@localhost',
    rivalUrl,
    effectiveOwnUrl,
    effectiveKeyword,
    pageTypeMismatch ? 'mismatch' : 'match',
    JSON.stringify(rivalSnapshot.headings.slice(0, 8)),
    JSON.stringify((rivalSnapshot.faqQuestions || []).slice(0, 6)),
    rivalSnapshot.title,
    rivalSnapshot.h1,
    rivalSnapshot.hasFaqSchema ? 'faqSchema' : 'noFaqSchema',
  ]);

  const geminiResult = await invokeGeminiWithCredits({
    email: userEmail || 'dev@localhost',
    isAdmin,
    feature: 'competitor_spy',
    cacheKey,
    prompt: systemInstructions + '\n\n' + userPrompt,
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

  // ── Parseo de la respuesta ──────────────────────────────────────────────────
  let verdict = '';
  let gaps: SpyGap[] = [];
  try {
    const raw = geminiResult.text;
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const parsed = JSON.parse(jsonStart !== -1 ? raw.substring(jsonStart, jsonEnd + 1) : raw);
    verdict = String(parsed.verdict || '').trim();
    if (Array.isArray(parsed.gaps)) {
      const rawGaps = parsed.gaps
        .filter((g: any) => g && (g.problem || g.suggestion))
        .slice(0, 4)
        .map((g: any) => ({
          area: String(g.area || 'Oportunidad').trim(),
          problem: String(g.problem || '').trim(),
          suggestion: String(g.suggestion || '').trim(),
        }));
      gaps = enrichSpyGaps(rawGaps, ownSnapshot, rivalSnapshot);
    }
  } catch (err) {
    console.error('[spyCompetitor] Error parseando respuesta IA:', err);
    return { success: false, error: 'Error al interpretar el análisis de la IA. Intentá de nuevo.' };
  }

  // ── Guardar snapshot para detección de cambios futura ───────────────────────
  // No persistimos faqPairs (pueden ser largos); sí las señales livianas.
  if (userEmail) {
    try {
      const { faqPairs: _pairs, ...slimRival } = rivalSnapshot as CompetitorSnapshot & {
        faqPairs?: unknown;
      };
      await saveCompetitorSnapshot(userEmail, rivalUrl, {
        ...slimRival,
        faqPairs: undefined,
      });
    } catch (err) {
      console.warn('[spyCompetitor] No se pudo guardar el snapshot:', err);
    }
  }

  return {
    success: true,
    data: {
      competitorUrl: rivalUrl,
      competitor: {
        title: rivalSnapshot.title,
        h1: rivalSnapshot.h1,
        headings: rivalSnapshot.headings,
        faqQuestions: rivalSnapshot.faqQuestions || [],
        hasFaqSchema: !!rivalSnapshot.hasFaqSchema,
        schemaTypes: rivalSnapshot.schemaTypes || [],
      },
      you: ownSnapshot
        ? {
            title: ownSnapshot.title,
            h1: ownSnapshot.h1,
            faqQuestions: ownSnapshot.faqQuestions || [],
            hasFaqSchema: !!ownSnapshot.hasFaqSchema,
            schemaTypes: ownSnapshot.schemaTypes || [],
          }
        : null,
      comparedAgainst: effectiveOwnUrl || null,
      pageTypeMismatch,
      autoMatched: !!autoMatchedOwnUrl,
      autoMatchedUrl: autoMatchedOwnUrl || null,
      verdict,
      gaps,
      changes,
      firstTime,
    },
    credits: geminiResult.credits,
  };
}

/**
 * Verifica en vivo una brecha del Espía (Schema FAQ / FAQ visibles).
 * Evita dar XP por "Ya lo apliqué" cuando el cambio no está en la web.
 */
export async function verifySpyGap(
  pageUrl: string,
  verifyKind: 'schema_faq' | 'schema_product' | 'faq_visible' | 'honor' = 'honor',
  expectedQuestions: string[] = []
) {
  if (!pageUrl?.trim()) {
    return {
      success: false,
      error: 'Necesitamos la URL de tu página para verificar. Pegala en "Tu página equivalente" y volvé a espiar.',
    };
  }

  let target = pageUrl.trim();
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = 'https://' + target;
  }

  // Honor system: título/H1/etc. (sin scrape obligatorio)
  if (verifyKind === 'honor') {
    return { success: true, verified: true, honor: true };
  }

  const page = await fetchPage(target);
  if (!page.ok || !page.html) {
    return {
      success: false,
      error: 'No pudimos leer tu página en vivo. ¿La URL es pública? Probá sin caché del hosting.',
    };
  }

  if (verifyKind === 'schema_faq') {
    const structured = extractExistingStructuredData(page.html);
    if (structured.hasFaqPage) {
      return { success: true, verified: true, detail: 'Detectamos Schema FAQPage en tu página. ¡Listo!' };
    }
    // El Schema no está, pero si ya tenés las preguntas visibles generamos el
    // código en el momento para que solo tengas que copiarlo y pegarlo.
    const livePairs = extractFaqPairs(page.html, 12);
    if (livePairs.length >= 1) {
      return {
        success: false,
        schemaReady: true,
        schemaCode: buildFaqJsonLd(livePairs),
        foundQuestions: livePairs.map((p) => p.question).slice(0, 8),
        error:
          `Detectamos ${livePairs.length} pregunta(s) en tu página ✅, pero todavía falta el Schema FAQPage (el código que leen Google y las IA). Copiá el bloque de acá abajo, pegalo en el HTML antes de </body>, guardá, borrá caché y reintentá.`,
      };
    }
    return {
      success: false,
      error:
        'Todavía no encontramos preguntas ni Schema en tu página en vivo. Verificá que la URL sea la correcta (la de la página donde pegaste las FAQ) y que hayas guardado/publicado los cambios; después borrá la caché del sitio y reintentá.',
    };
  }

  if (verifyKind === 'schema_product') {
    const structured = extractExistingStructuredData(page.html);
    if (structured.hasProduct) {
      return { success: true, verified: true, detail: 'Detectamos Schema Product en tu página. ¡Listo!' };
    }
    const titleM = page.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1M = page.html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : '';
    const h1 = h1M ? h1M[1].replace(/<[^>]+>/g, '').trim() : '';
    const info = detectProductInfo(page.html, title, h1);
    if (info.name) {
      // Generamos SIN precio a propósito: pegado a mano, un precio fijo se
      // desactualiza y si no coincide con el visible Google puede ignorar el
      // rich result. El precio/stock conviene dejarlos al plugin de la tienda.
      return {
        success: false,
        schemaReady: true,
        schemaCode: buildProductJsonLd(info, target, { includeOffers: false }),
        error:
          'Todavía no encontramos el Schema Product en tu HTML. Te generamos uno SIN precio (a propósito: un precio fijo pegado a mano se desactualiza y Google puede ignorarlo). Pegalo antes de </body>, guardá, borrá caché y reintentá. Para precio y stock automáticos, lo ideal es el plugin de tu tienda (WooCommerce/Shopify).',
      };
    }
    return {
      success: false,
      error:
        'No pudimos leer datos de producto (nombre/precio) en tu página. Verificá que sea la URL de la ficha del producto y que esté publicada; después reintentá.',
    };
  }

  if (verifyKind === 'faq_visible') {
    const pairs = extractFaqPairs(page.html, 12);
    if (pairs.length === 0) {
      return {
        success: false,
        error:
          'No detectamos preguntas con respuesta visibles en tu página. Agregá las FAQ en texto (H2/acordeón) y reintentá.',
      };
    }
    if (expectedQuestions.length > 0) {
      const live = pairs.map((p) => p.question.toLowerCase());
      const hit = expectedQuestions.some((q) =>
        live.some((lq) => lq.includes(q.toLowerCase().slice(0, 40)) || q.toLowerCase().includes(lq.slice(0, 40)))
      );
      if (!hit) {
        return {
          success: false,
          error: `Vimos ${pairs.length} pregunta(s), pero todavía no las que sugerimos. Revisá el texto y reintentá.`,
          foundQuestions: pairs.map((p) => p.question).slice(0, 5),
        };
      }
    }
    return {
      success: true,
      verified: true,
      detail: `Detectamos ${pairs.length} pregunta(s) en tu página.`,
      foundQuestions: pairs.map((p) => p.question).slice(0, 5),
    };
  }

  return { success: true, verified: true, honor: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// HUMAN SCORE — Analiza el "valor humano" de una página y genera Misiones Human.
// Filosofía SEO Jump: la IA optimiza (H1, meta, enlaces); el humano aporta lo
// irreemplazable (experiencia, evidencia, opinión, casos, datos propios).
// El puntaje es determinístico (humanScore.ts). Gemini SOLO enriquece las
// misiones con ejemplos a medida del negocio; NUNCA escribe la experiencia.
// ═══════════════════════════════════════════════════════════════════════════

/** Descarga el HTML en vivo de una página (sin caché) para análisis de contenido. */
async function fetchLiveHtml(pageUrl: string): Promise<{ ok: true; html: string } | { ok: false; message: string }> {
  try {
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
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) {
      return { ok: false, message: `No pude acceder a la página (Error ${response.status}). Verificá que la URL sea pública.` };
    }
    return { ok: true, html: await response.text() };
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      return { ok: false, message: 'La página tardó demasiado en responder (>9s). Intentá de nuevo.' };
    }
    return { ok: false, message: `Error al acceder a la página: ${err?.message || err}` };
  }
}

/** Texto plano recortado para pasarle contexto real a la IA (sin tags). */
function htmlToSnippet(html: string, maxChars = 1400): string {
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, maxChars);
}

/**
 * Analiza el valor humano de una página: puntaje 0-100, 6 dimensiones y
 * misiones para las dimensiones débiles. La IA personaliza los ejemplos de las
 * misiones según el rubro y el contenido real (no escribe el contenido).
 */
export async function getHumanScore(
  pageUrl: string,
  goldKeyword?: string,
  businessFocus?: string
) {
  const urlSanit = sanitizeInput(pageUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  let cleanUrl = urlSanit.sanitized;
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let cleanKeyword = '';
  if (goldKeyword) {
    const kwSanit = sanitizeInput(goldKeyword, 'keyword');
    if (kwSanit.isValid) cleanKeyword = kwSanit.sanitized;
  }
  let cleanFocus = '';
  if (businessFocus) {
    const focusSanit = sanitizeInput(businessFocus, 'keyword');
    if (focusSanit.isValid) cleanFocus = focusSanit.sanitized.slice(0, 300);
  }

  try {
    // 1. Descargar y medir señales (determinístico, sin IA)
    const fetched = await fetchLiveHtml(cleanUrl);
    if (fetched.ok === false) {
      return { success: false, error: fetched.message };
    }

    const signals = extractHumanSignals(fetched.html, cleanUrl);
    const result = computeHumanScore(signals);

    // 2. Enriquecer misiones con ejemplos a medida del negocio (IA, opcional)
    let missions: HumanMission[] = result.missions;
    let credits: AiCreditsStatus | undefined;

    if (missions.length > 0) {
      const apiKey = process.env.GEMINI_API_KEY;
      const session = await auth();
      const userEmail = session?.user?.email || '';
      const isAdmin = await checkIsAdmin();

      if (apiKey && (userEmail || isAdmin)) {
        const nicho = inferNichoFromUrl(cleanUrl);
        const snippet = htmlToSnippet(fetched.html);
        const weakList = missions.map((m) => `- ${m.id}: ${m.title}`).join('\n');

        const prompt = `Sos un editor de contenido experto en E-E-A-T, SEO, AEO y GEO. Ayudás a un dueño de negocio a que su contenido demuestre valor humano REAL. NO escribís el contenido por él: le das indicaciones concretas de QUÉ agregar y DÓNDE, con ejemplos adaptados a su negocio.

Negocio/rubro (inferido): "${nicho || 'no identificado'}"
Palabra clave: "${cleanKeyword || 'no especificada'}"
Qué ofrece: "${cleanFocus || 'no especificado — deducilo del texto'}"

Extracto real de la página (texto plano):
"""
${snippet}
"""

El contenido es flojo en estas dimensiones de "valor humano":
${weakList}

Para CADA dimensión de la lista, devolvé una recomendación ultra-concreta y accionable, adaptada a ESTE negocio (no genérica). Cada ejemplo debe sonar como algo que este dueño podría escribir de verdad, mencionando su rubro o producto.

Devolvé ESTRICTAMENTE un JSON sin markdown, con esta forma:
{
  "experiencia": { "tip": "1 frase de qué hacer en ESTA página", "examples": ["ejemplo concreto 1", "ejemplo concreto 2"] },
  "casosReales": { "tip": "...", "examples": ["...", "..."] }
}
Incluí SOLO las claves de la lista de dimensiones débiles. Los "tip" en 1 oración, máximo 2 examples por dimensión, cada uno de máximo 20 palabras. Tono directo, en español rioplatense, sin tecnicismos.`;

        const cacheKey = buildGeminiCacheKey([
          'human_score_v1',
          userEmail || 'dev@localhost',
          cleanUrl,
          cleanKeyword,
          missions.map((m) => m.id).join(','),
          String(result.score),
        ]);

        try {
          const geminiResult = await invokeGeminiWithCredits({
            email: userEmail || 'dev@localhost',
            isAdmin,
            feature: 'human_score',
            cacheKey,
            prompt,
            apiKey,
          });

          if (geminiResult.ok) {
            credits = geminiResult.credits;
            const txt = geminiResult.text;
            const start = txt.indexOf('{');
            const end = txt.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
              const parsed = JSON.parse(txt.substring(start, end + 1));
              missions = missions.map((m) => {
                const ai = parsed[m.id];
                if (ai && (ai.tip || Array.isArray(ai.examples))) {
                  return {
                    ...m,
                    why: typeof ai.tip === 'string' && ai.tip.trim() ? ai.tip.trim() : m.why,
                    examples: Array.isArray(ai.examples) && ai.examples.length
                      ? ai.examples.slice(0, 2).map((e: any) => String(e))
                      : m.examples,
                  };
                }
                return m;
              });
            }
          } else {
            credits = geminiResult.credits;
            // Sin créditos o error de IA: seguimos con los ejemplos determinísticos.
          }
        } catch (aiErr) {
          console.warn('[getHumanScore] Enriquecimiento IA falló, uso ejemplos base:', aiErr);
        }
      }
    }

    return {
      success: true,
      score: result.score,
      band: result.band,
      headline: result.headline,
      dimensions: result.dimensions,
      missions,
      wordCount: result.wordCount,
      thin: result.thin,
      credits,
    };
  } catch (error: any) {
    console.error('Error en getHumanScore:', error);
    logErrorToFile('getHumanScore', { pageUrl: cleanUrl }, error.status || '500', error.message || String(error));
    return { success: false, error: 'No pudimos analizar el valor humano de la página. Intentá de nuevo.' };
  }
}

/**
 * Verifica que el usuario haya agregado el valor humano de una dimensión puntual.
 * Re-scrapea la página y comprueba si esa dimensión ya está "presente".
 * No usa IA: es una comprobación determinística de las señales.
 */
export async function verifyHumanMission(pageUrl: string, dimension: HumanDimensionId) {
  const validDimensions: HumanDimensionId[] = ['experiencia', 'evidencia', 'casosReales', 'opinion', 'datosPropios', 'originalidad'];
  if (!pageUrl || !validDimensions.includes(dimension)) {
    return { success: false, message: 'Faltan datos para verificar.' };
  }

  const urlSanit = sanitizeInput(pageUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, message: urlSanit.error };
  }
  let cleanUrl = urlSanit.sanitized;
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  const fetched = await fetchLiveHtml(cleanUrl);
  if (fetched.ok === false) {
    return { success: false, message: fetched.message };
  }

  const signals = extractHumanSignals(fetched.html, cleanUrl);
  const passed = humanDimensionPasses(dimension, signals);

  if (passed) {
    return { success: true, message: '¡Detectamos el aporte humano en tu página! Misión completada.' };
  }
  return {
    success: false,
    message: 'Todavía no lo detectamos en la página. ¿Ya publicaste el cambio y vaciaste la caché? Revisá y volvé a verificar.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPA DE COMPRENSIÓN AEO — qué entiende Google/IA de la página (sin jerga Schema)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analiza una URL y devolvé checklist de comprensión + (si aplica) código FAQ listo para pegar.
 * Sin créditos de IA: es 100% determinístico.
 */
export async function getComprehensionMap(pageUrl: string, platformId?: string) {
  const urlSanit = sanitizeInput(pageUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, error: urlSanit.error };
  }
  let cleanUrl = urlSanit.sanitized;
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  try {
    const fetched = await fetchLiveHtml(cleanUrl);
    if (fetched.ok === false) {
      return { success: false, error: fetched.message };
    }

    const map = analyzeComprehension(fetched.html, cleanUrl);
    const guide = getFaqStructurePasteGuide(platformId || 'wp_woo');
    // offerCode: el schema recomendado según el tipo de página (FAQ, Producto, Artículo u Organización).
    const offerCode = map.offer?.code ?? null;
    // faqCode: compat hacia atrás (solo si la oferta es FAQ).
    const faqCode = map.offer?.type === 'faq' ? map.offer.code : null;
    // editorHint: sugerencia suave de dónde pegar el código (Gutenberg / maquetador / Shopify).
    // En productos prioriza Editor clásico; maquetador queda sobre todo para home / constructores fuertes.
    const editorHint = detectSchemaInstallHints(fetched.html, map.pageType);

    return {
      success: true,
      map,
      offer: map.offer,
      offerCode,
      faqCode,
      guide,
      editorHint,
    };
  } catch (error: any) {
    console.error('Error en getComprehensionMap:', error);
    logErrorToFile(
      'getComprehensionMap',
      { pageUrl: cleanUrl },
      error.status || '500',
      error.message || String(error)
    );
    return {
      success: false,
      error: 'No pudimos analizar la comprensión de esta página. Intentá de nuevo.',
    };
  }
}

const STRUCTURE_PRESENT_MSG: Record<string, string> = {
  faq: 'Listo: Google y las IA ya pueden leer tus preguntas frecuentes sin ambigüedad.',
  product: 'Listo: Google y las IA ya reconocen esta página como un producto.',
  article: 'Listo: Google y las IA ya reconocen esta página como un artículo.',
  organization: 'Listo: Google y las IA ya identifican a la empresa responsable.',
};

function isStructureTypePresent(
  map: ReturnType<typeof analyzeComprehension>,
  offerType: string
): boolean {
  const s = map.existingStructured;
  switch (offerType) {
    case 'faq':
      return s.hasFaqPage;
    case 'product':
      return s.hasProduct;
    case 'article':
      return s.hasArticle;
    case 'organization':
      return s.hasOrganization || s.hasLocalBusiness;
    default:
      return false;
  }
}

/**
 * Verifica que la página ya tenga el bloque estructurado que se ofreció
 * (FAQPage, Product, Article u Organization). Compat: sin offerType, valida FAQ.
 */
export async function verifyComprehensionFaqStructure(pageUrl: string, offerType: string = 'faq') {
  if (!pageUrl?.trim()) {
    return { success: false, message: 'Falta la URL para verificar.' };
  }

  const urlSanit = sanitizeInput(pageUrl, 'url');
  if (!urlSanit.isValid) {
    return { success: false, message: urlSanit.error };
  }
  let cleanUrl = urlSanit.sanitized;
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  try {
    const fetched = await fetchLiveHtml(cleanUrl);
    if (fetched.ok === false) {
      return { success: false, message: fetched.message };
    }

    const map = analyzeComprehension(fetched.html, cleanUrl);
    if (isStructureTypePresent(map, offerType)) {
      return {
        success: true,
        message: STRUCTURE_PRESENT_MSG[offerType] || STRUCTURE_PRESENT_MSG.faq,
        xp: 40,
      };
    }

    return {
      success: false,
      message:
        'Todavía no detectamos el bloque en tu web. ¿Lo pegaste, publicaste y borraste la caché?',
    };
  } catch (error: any) {
    console.error('Error en verifyComprehensionFaqStructure:', error);
    return {
      success: false,
      message: 'No pudimos volver a leer la página. Intentá de nuevo en unos segundos.',
    };
  }
}

