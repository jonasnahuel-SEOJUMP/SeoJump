/**
 * Guía práctica: dónde editar en el CMS, sin jerga SEO.
 * Paquete 1 (lenguaje claro) + 2 (dónde edito) + 3 (antes/después).
 */

import { decodeHtmlEntities } from './textUtils';

export const CMS_PLATFORMS = [
  { id: 'wp_woo', label: 'WordPress + Tienda (WooCommerce)', icon: '🛒' },
  { id: 'wp', label: 'WordPress (sin tienda)', icon: '📝' },
  { id: 'tiendanube', label: 'Tiendanube', icon: '☁️' },
  { id: 'shopify', label: 'Shopify', icon: '🛍️' },
  { id: 'other', label: 'Otra / no sé', icon: '❓' },
];

const STORAGE_KEY = 'seojump_cms_platform';

export function getStoredPlatform() {
  if (typeof window === 'undefined') return 'wp_woo';
  return localStorage.getItem(STORAGE_KEY) || 'wp_woo';
}

export function setStoredPlatform(platformId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, platformId);
}

/** Extrae slug legible de una URL para buscar en el panel admin */
export function slugFromUrl(pageUrl) {
  if (!pageUrl) return '';
  try {
    const path = new URL(pageUrl.startsWith('http') ? pageUrl : `https://${pageUrl}`).pathname;
    const segments = path.replace(/\/$/, '').split('/').filter(Boolean);
    const last = segments[segments.length - 1] || '';
    return decodeURIComponent(last).replace(/-/g, ' ').trim();
  } catch {
    return '';
  }
}

export function brandFromSiteUrl(siteUrl) {
  if (!siteUrl) return 'Tu tienda';
  try {
    const host = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`).hostname;
    const name = host.replace(/^www\./, '').split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
  } catch {
    return 'Tu tienda';
  }
}

/**
 * Detecta tipo de página por URL (WooCommerce patterns + heurísticas).
 */
export function detectPageType(pageUrl) {
  const fallback = {
    id: 'page',
    label: 'Página de tu web',
    badgeColor: 'bg-slate-500/20 text-slate-200 border border-slate-400/30',
    searchHint: '',
  };

  if (!pageUrl) return fallback;

  const lower = pageUrl.toLowerCase();
  const slug = slugFromUrl(pageUrl);

  if (lower.includes('/categoria-producto/') || lower.includes('/product-category/') ||
      (lower.includes('/categoria/') && !lower.includes('/producto/'))) {
    return {
      id: 'category',
      label: 'Categoría de tienda',
      badgeColor: 'bg-purple-500/20 text-purple-200 border border-purple-400/30',
      searchHint: slug,
    };
  }

  if (lower.includes('/producto/') || lower.includes('/product/') || lower.includes('/shop/')) {
    return {
      id: 'product',
      label: 'Ficha de producto',
      badgeColor: 'bg-blue-500/20 text-sky-200 border border-blue-400/30',
      searchHint: slug,
    };
  }

  try {
    const parsed = new URL(lower.startsWith('http') ? lower : `https://${lower}`);
    if (parsed.pathname === '/' || parsed.pathname === '') {
      return {
        id: 'home',
        label: 'Página de inicio',
        badgeColor: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
        searchHint: 'inicio',
      };
    }
    if (parsed.pathname.includes('/blog/') || parsed.pathname.includes('/noticia')) {
      return {
        id: 'post',
        label: 'Entrada de blog',
        badgeColor: 'bg-orange-500/20 text-orange-200 border border-orange-400/30',
        searchHint: slug,
      };
    }
  } catch {
    if (lower.endsWith('.com/') || lower.endsWith('.com') || lower.endsWith('.ar/') || lower.endsWith('.ar')) {
      return {
        id: 'home',
        label: 'Página de inicio',
        badgeColor: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30',
        searchHint: 'inicio',
      };
    }
  }

  return {
    id: 'page',
    label: 'Página estática',
    badgeColor: 'bg-slate-500/20 text-slate-200 border border-slate-400/30',
    searchHint: slug,
  };
}

/** Nombres en lenguaje humano (paquete 1) */
export function getPlainMissionLabels(missionType) {
  switch (missionType) {
    case 'H1':
      return {
        shortTitle: 'Título principal de la página',
        fieldName: 'Título grande (el que ve el visitante primero)',
        googleName: 'Título principal',
        action: 'Cambiá el título grande de esta página',
        verifyLabel: 'Pegá acá el título que pusiste en tu web',
      };
    case 'META':
      return {
        shortTitle: 'Texto debajo del título en Google',
        fieldName: 'Descripción SEO (Meta descripción)',
        googleName: 'Descripción en Google',
        action: 'Escribí el texto que la gente ve debajo de tu título en Google',
        verifyLabel: 'Pegá acá ese texto de descripción',
      };
    case 'ALT':
      return {
        shortTitle: 'Descripción de una imagen',
        fieldName: 'Texto alternativo (ALT) de la imagen',
        googleName: 'Descripción de imagen',
        action: 'Agregá una descripción a una imagen de esta página',
        verifyLabel: 'Pegá acá el texto ALT que usaste',
      };
    case 'AEO':
      return {
        shortTitle: 'Preguntas y respuestas para la IA',
        fieldName: 'Bloque de preguntas y respuestas (al final de la página)',
        googleName: 'Contenido para ChatGPT y Google IA',
        action: 'Agregá al final de la página un bloque de preguntas y respuestas',
        verifyLabel: 'Pegá acá una de las respuestas que escribiste en tu web',
      };
    default:
      return {
        shortTitle: 'Mejora en tu página',
        fieldName: 'Campo a editar',
        googleName: 'Contenido',
        action: 'Hacé el cambio en tu web',
        verifyLabel: 'Pegá acá lo que modificaste',
      };
  }
}

/**
 * Ruta paso a paso: ¿dónde edito? (paquete 2)
 */
export function getEditWhereGuide(pageUrl, missionType, platformId = 'wp_woo') {
  const page = detectPageType(pageUrl);
  const labels = getPlainMissionLabels(missionType);
  const search = page.searchHint ? `«${page.searchHint}»` : 'el nombre de esta página';
  const steps = [];
  let adminHint = '';
  let fieldLabel = labels.fieldName;

  if (platformId === 'tiendanube') {
    steps.push('Entrá al panel de Tiendanube → Productos o Páginas.');
    steps.push(`Buscá ${search} y abrí la edición.`);
    steps.push(`Modificá el campo de ${labels.shortTitle.toLowerCase()}.`);
    steps.push('Guardá los cambios y esperá 1–2 minutos antes de verificar acá.');
    return { steps, fieldLabel, platformLabel: 'Tiendanube', openPageUrl: pageUrl };
  }

  if (platformId === 'shopify') {
    steps.push('Shopify Admin → Productos o Páginas online.');
    steps.push(`Buscá ${search}.`);
    steps.push(`Editá ${labels.shortTitle.toLowerCase()} en el formulario.`);
    steps.push('Guardá y volvé acá para verificar.');
    return { steps, fieldLabel, platformLabel: 'Shopify', openPageUrl: pageUrl };
  }

  if (platformId === 'other') {
    steps.push('Entrá al panel donde editás tu web (WordPress, Tiendanube, etc.).');
    steps.push(`Buscá la página: ${pageUrl || 'la URL de arriba'}.`);
    steps.push(`Cambiá el ${labels.shortTitle.toLowerCase()}.`);
    steps.push('Guardá, abrí la página en el navegador y verificá acá.');
    return { steps, fieldLabel, platformLabel: 'Tu plataforma', openPageUrl: pageUrl };
  }

  // WordPress (+ Woo)
  const isWoo = platformId === 'wp_woo';

  if (page.id === 'product' && isWoo) {
    adminHint = 'wp-admin → Productos → Todos los productos';
    steps.push('Entrá a tu WordPress → menú **Productos** → **Todos los productos**.');
    steps.push(`En el buscador escribí ${search} y hacé clic en **Editar**.`);
    if (missionType === 'H1') {
      fieldLabel = 'Nombre del producto (arriba del todo)';
      steps.push('El **Nombre del producto** es el título grande. Cambiá ese texto.');
    } else if (missionType === 'META') {
      fieldLabel = 'Descripción corta o plugin SEO (Yoast / Rank Math)';
      steps.push('Bajá hasta **Descripción corta** o la caja de **Yoast SEO / Rank Math** → Meta descripción.');
    } else if (missionType === 'ALT') {
      fieldLabel = 'Texto alternativo de la imagen del producto';
      steps.push('En la columna derecha, clic en la **imagen del producto** → campo **Texto alternativo**.');
    } else if (missionType === 'AEO') {
      fieldLabel = 'Descripción larga del producto (al final del texto)';
      steps.push('Bajá hasta el final de la **Descripción del producto** (el texto largo, no el nombre).');
      steps.push('Agregá un subtítulo: **Preguntas frecuentes** o **Preguntas y respuestas**.');
      steps.push('Escribí al menos 3 preguntas que te hace un cliente, cada una con una respuesta corta (2–3 oraciones).');
      steps.push('Ejemplo de pregunta: «¿Para qué sirve?» — y debajo la respuesta en texto normal.');
    } else {
      steps.push(`Editá el contenido según la misión: ${labels.shortTitle}.`);
    }
  } else if (page.id === 'category' && isWoo) {
    adminHint = 'wp-admin → Productos → Categorías';
    steps.push('WordPress → **Productos** → **Categorías**.');
    steps.push(`Buscá la categoría ${search} → **Editar**.`);
    if (missionType === 'H1') {
      fieldLabel = 'Nombre de la categoría';
      steps.push('Cambiá el **Nombre** de la categoría (es el título principal).');
    } else if (missionType === 'META') {
      steps.push('En la parte de abajo o en Yoast/Rank Math, editá la **Meta descripción**.');
    } else {
      steps.push(`Completá la mejora: ${labels.shortTitle}.`);
    }
  } else if (page.id === 'home') {
    adminHint = 'wp-admin → Páginas (o Ajustes → Lectura → Portada)';
    steps.push('WordPress → **Páginas** → buscá tu **Página de inicio** (o la que configuraste como portada).');
    steps.push('Hacé clic en **Editar** (o **Editar con Elementor** si usás constructor visual).');
    if (missionType === 'H1') {
      fieldLabel = 'Título de la página o bloque de encabezado principal';
      steps.push('Cambiá el **título grande** de la portada (nombre de la página o bloque H1).');
    } else if (missionType === 'META') {
      steps.push('Buscá **Yoast SEO** o **Rank Math** abajo → caja **Meta descripción**.');
    } else {
      steps.push(`Aplicá el cambio: ${labels.shortTitle}.`);
    }
  } else if (page.id === 'post') {
    adminHint = 'wp-admin → Entradas';
    steps.push('WordPress → **Entradas** → **Todas las entradas**.');
    steps.push(`Buscá ${search} → **Editar**.`);
    steps.push(missionType === 'H1'
      ? 'El **Título** de la entrada (arriba) es lo que tenés que cambiar.'
      : `Editá ${labels.shortTitle.toLowerCase()} en el editor.`);
  } else {
    adminHint = 'wp-admin → Páginas';
    steps.push('WordPress → **Páginas** → **Todas las páginas**.');
    steps.push(`Buscá ${search} → **Editar**.`);
    if (missionType === 'H1') {
      fieldLabel = 'Título de la página (arriba del editor)';
      steps.push('Cambiá el **Título** que aparece arriba del contenido.');
    } else if (missionType === 'META') {
      steps.push('En **Yoast SEO** o **Rank Math**, completá la **Meta descripción**.');
    } else if (missionType === 'ALT') {
      steps.push('Clic en una **imagen** del contenido → **Texto alternativo** en la barra lateral.');
    } else {
      steps.push(`Completá: ${labels.shortTitle}.`);
    }
  }

  steps.push('Clic en **Actualizar** o **Publicar** para guardar.');
  steps.push('⚠️ Si usás caché (WP Rocket, LiteSpeed), borrá caché antes de verificar acá.');

  return {
    steps,
    fieldLabel,
    adminHint,
    platformLabel: platformId === 'wp_woo' ? 'WordPress + WooCommerce' : 'WordPress',
    pageTypeLabel: page.label,
    openPageUrl: pageUrl,
  };
}

/** Normaliza para comparar (minúsculas, sin acentos, sin signos) */
function normForCompare(text) {
  return decodeHtmlEntities(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Palabras vacías que no aportan al comparar intención (es). */
const COMPARE_STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'para', 'con', 'en', 'a',
  'del', 'un', 'una', 'unos', 'unas', 'por', 'su', 'sus', 'al', 'que', 'tu',
]);

/** Reduce plural→singular en español (aproximado, suficiente para deduplicar). */
function singularize(word) {
  if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Tokens significativos (sin stopwords, en singular) para comparar intención. */
function significantTokens(text) {
  return normForCompare(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !COMPARE_STOPWORDS.has(w))
    .map(singularize)
    .filter(Boolean);
}

/**
 * ¿El núcleo ya cubre la keyword? Compara por tokens en singular, así
 * "paño de microfibra" se reconoce dentro de "paños y microfibras" y se evita
 * la redundancia singular/plural (ej: «Paño de microfibra - Paños y microfibras»).
 */
function coreCoversKeyword(core, kw) {
  const kwTokens = significantTokens(kw);
  if (kwTokens.length === 0) return true;
  const coreTokens = new Set(significantTokens(core));
  const present = kwTokens.filter((t) => coreTokens.has(t)).length;
  return present / kwTokens.length >= 0.6;
}

/** Baja el "grito" de palabras EN MAYÚSCULAS (≥4 letras) a Capitalizado. */
function deShout(text) {
  return (text || '').replace(/\b([A-ZÁÉÍÓÚÑ]{4,})\b/g, (w) =>
    w.charAt(0) + w.slice(1).toLowerCase()
  );
}

/** ¿Este fragmento es el nombre de la tienda/marca (para no duplicarlo)? */
function looksLikeBrand(part, brand) {
  const p = normForCompare(part).replace(/\s/g, '');
  const b = normForCompare(brand).replace(/\s/g, '');
  if (!p || !b) return false;
  return p === b || p.includes(b) || b.includes(p) || /shop|tienda|store/.test(part.toLowerCase());
}

/** Cierra el título con la tienda respetando un máximo de caracteres (SEO: ~60) */
function composeWithBrand(core, brand, maxLen = 60) {
  const clean = (s) => s.replace(/[\s\-–—|.,]+$/, '').trim();
  core = clean(core);
  const suffix = ` | ${brand}`;
  if (`${core}${suffix}`.length <= maxLen) return `${core}${suffix}`;

  const room = maxLen - suffix.length;
  // Si la marca es tan larga que casi no deja lugar, priorizar la descripción
  if (room < 12) return clean(core.slice(0, maxLen));

  let trimmed = core.slice(0, room);
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace > room * 0.6) trimmed = trimmed.slice(0, lastSpace);
  return `${clean(trimmed)}${suffix}`;
}

/**
 * Núcleo descriptivo del producto/servicio: QUÉ es (preserva la intención de
 * búsqueda). Prioridad: título en vivo (sin la marca) > slug de la URL > keyword.
 * Siempre garantiza que la keyword esté presente.
 */
function deriveDescriptiveCore(text, brand) {
  if (!text) return '';
  return decodeHtmlEntities(text)
    .split(/\s*[|–—]\s*|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((part) => !looksLikeBrand(part, brand))
    .join(' - ')
    .trim();
}

function deriveProductCore(preview, slug, kw, brand, cap) {
  const liveTitle = preview && preview.title ? preview.title : '';
  const liveH1 = preview && preview.h1 ? preview.h1 : '';

  let core = deriveDescriptiveCore(liveTitle, brand);
  const h1Core = deriveDescriptiveCore(liveH1, brand);

  // Preservar el nicho: si el H1 aporta más términos significativos (ej:
  // «...para Estética Vehicular») y no es excesivamente largo, usarlo como base.
  if (
    h1Core &&
    significantTokens(h1Core).length > significantTokens(core).length &&
    h1Core.length <= 65
  ) {
    core = h1Core;
  }

  if (!core && slug) core = cap(slug);
  if (!core) core = kw ? cap(kw) : brand;

  // Garantizar la keyword SOLO si el núcleo todavía no la cubre (comparación
  // por tokens singular/plural, para no duplicar «paño»/«paños»).
  if (kw && core && !coreCoversKeyword(core, kw)) {
    core = `${cap(kw)} - ${core}`;
  }

  // Bajar el "grito" de mayúsculas heredadas del título/H1 original.
  return deShout(core);
}

/** Texto sugerido listo para copiar (paquete 1 + 3) */
export function buildSuggestedText(missionType, keyword, pageUrl, siteUrl, preview = null) {
  const kw = (keyword || '').trim();
  const brand = brandFromSiteUrl(siteUrl);
  const slug = slugFromUrl(pageUrl);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

  if (missionType === 'H1') {
    const core = deriveProductCore(preview, slug, kw, brand, cap);
    if (!core) return `${brand} — tu mejor opción online`;
    return composeWithBrand(core, brand, 60);
  }

  if (missionType === 'META') {
    if (kw || slug || (preview && preview.title)) {
      const core = deriveProductCore(preview, slug, kw, brand, cap);
      const base = `Comprá ${core} en ${brand}. Asesoramiento y envíos a todo el país.`;
      return base.length > 160 ? base.slice(0, 157).trim() + '...' : base;
    }
    const base = `${brand}: productos y soluciones para tu vehículo. Consultanos sin compromiso.`;
    return base.length > 160 ? base.slice(0, 157) + '...' : base;
  }

  if (missionType === 'ALT') {
    return kw
      ? `${cap(kw)} — imagen en ${brand}`
      : `Producto ${slug || brand} — foto referencia`;
  }

  if (missionType === 'AEO') {
    const topic = kw || slug || 'este producto';
    return [
      `Preguntas frecuentes sobre ${cap(topic)}`,
      '',
      '¿Para qué sirve?',
      `El ${cap(topic)} está pensado para [explicá en 2 oraciones qué problema resuelve].`,
      '',
      '¿Cómo se usa?',
      '[Explicá los pasos básicos en 2 oraciones.]',
      '',
      '¿Cuál es la diferencia con otros productos?',
      '[Contá en qué se destaca en 2 oraciones.]',
    ].join('\n');
  }

  return kw ? `Preguntas frecuentes sobre ${kw}` : 'Preguntas frecuentes';
}

/** Texto del búho — sin jerga, con ejemplo concreto */
export function getOwlExplanation(missionType, keyword) {
  const kw = (keyword || '').trim();
  switch (missionType) {
    case 'H1':
      return 'El título principal es lo primero que lee Google y tu visitante. Tiene que ser claro, incluir tu palabra clave y decir de qué trata la página.';
    case 'META':
      return 'El texto debajo del título en Google es como el cartel de tu local en la vereda. Un buen texto convence a la gente de entrar a tu web en vez de seguir de largo.';
    case 'ALT':
      return 'Google no ve imágenes, pero sí lee su descripción. Si subís una foto sin describirla, perdés oportunidades en Google Imágenes.';
    case 'AEO':
      return kw
        ? `Cuando alguien le pregunta a ChatGPT o Google IA algo como «${kw}», la máquina busca páginas que respondan claro. Lo que tenés que agregar es un bloque de preguntas y respuestas al final de la página: preguntas reales (por ejemplo «¿Para qué sirve?») con respuestas cortas en texto normal. No es un formulario ni un chat del sitio: es contenido escrito, como un mini manual para el cliente.`
        : 'Un bloque de preguntas y respuestas es un texto al final de tu página con dudas reales de tus clientes y respuestas cortas. ChatGPT y Google IA leen eso para recomendar tu negocio cuando alguien hace una pregunta.';
    default:
      return 'Hacé el cambio en tu web siguiendo los pasos de arriba. Cuando termines, pegá acá lo que escribiste para que lo verifiquemos en vivo.';
  }
}

/** Valor "antes" desde scrape — decodificado y alineado con lo que Google muestra */
export function getCurrentValueFromPreview(missionType, preview) {
  if (!preview) return '';
  if (missionType === 'H1') {
    // Google muestra el <title> en resultados; el H1 visible puede ser distinto
    return decodeHtmlEntities(preview.title || preview.h1 || '');
  }
  if (missionType === 'META') return decodeHtmlEntities(preview.description || '');
  return '';
}

/** Display para tarjetas de misión (sin jerga) */
export function getMissionDisplayPlain(mission, goldKeyword, siteUrl) {
  const kw = (mission.keyword || goldKeyword || '').trim();
  const labels = getPlainMissionLabels(mission.type);
  const page = detectPageType(mission.page);

  let title = labels.shortTitle;
  let description = labels.action;

  if (mission.type === 'AEO') {
    title = 'Que ChatGPT y Google IA te recomienden';
    description = kw
      ? `La gente busca «${kw}» en Google. Agregá al final de esta página un bloque de preguntas y respuestas: preguntas como las que te hace un cliente («¿Para qué sirve?», «¿Cómo se usa?») con respuestas cortas. Así la IA puede citar tu página.`
      : 'Agregá al final de esta página un bloque de preguntas y respuestas con dudas reales de tus clientes y respuestas cortas. Así ChatGPT y Google IA pueden recomendar tu negocio.';
  } else if (kw) {
    description += ` incluyendo «${kw}».`;
  } else {
    description += '.';
  }

  return {
    title,
    description,
    objective: kw ? `🎯 Incluí en el texto: «${kw}»` : null,
    pageTypeLabel: page.label,
    suggestedText: buildSuggestedText(mission.type, kw, mission.page, siteUrl),
  };
}

/** Instrucciones para enviar al diseñador / quien administra la web */
export function buildDesignerInstructions(mission, platformId, siteUrl, suggestedText, preview) {
  const labels = getPlainMissionLabels(mission.type);
  const guide = getEditWhereGuide(mission.page, mission.type, platformId);
  const current = getCurrentValueFromPreview(mission.type, preview);
  const kw = mission.keyword || '';

  return [
    `Hola! Necesito un cambio SEO en mi web:`,
    ``,
    `📄 Página: ${mission.page}`,
    `📌 Tipo: ${guide.pageTypeLabel}`,
    `✏️ Qué cambiar: ${labels.shortTitle}`,
    kw ? `🔑 Palabra clave: ${kw}` : '',
    ``,
    `🗺️ Dónde editarlo (${guide.platformLabel}):`,
    ...guide.steps.map((s, i) => `${i + 1}. ${s.replace(/\*\*/g, '')}`),
    ``,
    current ? `👀 Texto actual: "${current}"` : '',
    `✅ Texto sugerido: "${suggestedText}"`,
    ``,
    `Gracias!`,
  ].filter(Boolean).join('\n');
}
