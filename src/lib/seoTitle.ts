/** Límites de longitud para títulos SEO (Yoast / Rank Math — zona verde) */
export const MAX_SEO_TITLE_LENGTH = 60;
export const IDEAL_SEO_TITLE_MIN = 50;

function cleanTrailingSeparators(s: string): string {
  return s.replace(/[\s\-–—|.,]+$/, '').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isSeoTitleLengthOk(title: string, maxLen = MAX_SEO_TITLE_LENGTH): boolean {
  return !!(title && title.length <= maxLen);
}

/**
 * Ajusta un título sugerido al máximo permitido. Prioriza quitar el sufijo de
 * marca/tienda antes de truncar a mitad de frase.
 */
export function fitSeoTitle(
  title: string,
  options?: { maxLen?: number; brandHints?: string[] }
): string {
  const maxLen = options?.maxLen ?? MAX_SEO_TITLE_LENGTH;
  let t = (title || '').trim();
  if (!t || t.length <= maxLen) return t;

  const brandHints = (options?.brandHints || [])
    .map((b) => (b || '').trim())
    .filter(Boolean);

  for (const brand of brandHints) {
    for (const sep of ['|', '-', '–', '—']) {
      const re = new RegExp(`\\s*${escapeRegex(sep)}\\s*${escapeRegex(brand)}\\s*$`, 'i');
      const stripped = cleanTrailingSeparators(t.replace(re, ''));
      if (stripped.length <= maxLen && stripped.length >= 20) {
        t = stripped;
        if (t.length <= maxLen) return t;
      }
    }
  }

  const pipeParts = t.split(/\s*\|\s*/);
  if (pipeParts.length > 1) {
    const withoutLast = cleanTrailingSeparators(pipeParts.slice(0, -1).join(' | '));
    if (withoutLast.length <= maxLen && withoutLast.length >= 20) {
      return withoutLast;
    }
  }

  const cut = t.lastIndexOf(' ', maxLen - 1);
  return cleanTrailingSeparators(
    cut > maxLen * 0.5 ? t.slice(0, cut) : t.slice(0, maxLen)
  );
}

/** Extrae posibles nombres de marca/tienda desde un título o contexto de negocio */
export function extractBrandHints(...sources: Array<string | undefined | null>): string[] {
  const hints = new Set<string>();
  for (const src of sources) {
    const text = (src || '').trim();
    if (!text) continue;
    const parts = text.split(/\s*[|–—]\s*|\s+-\s+/);
    const last = (parts[parts.length - 1] || '').trim();
    if (last.length >= 3 && last.length <= 40) hints.add(last);
  }
  return [...hints];
}

function normalizeSeoText(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Rol del negocio (distribuidora / catálogo / tienda completa).
 * NO incluye diferenciales sueltos como "importación directa": esos pueden
 * aparecer en un título de producto y no salvan un eje en un solo SKU.
 */
const BUSINESS_ROLE_SIGNALS = [
  'distribuidora',
  'distribuidor',
  'mayorista',
  'mayoristas',
  'productos de',
  'tienda de',
  'tienda online',
  'catalogo',
  'catálogo',
  'multimarca',
  'venta mayorista',
  'venta minorista',
];

/** Diferenciales competitivos (pueden coexistir con un título de producto). */
const DIFFERENTIAL_SIGNALS = [
  'importacion directa',
  'importación directa',
];

/** Productos concretos que NO deben ser el eje de una home/mayorista. */
const SINGLE_PRODUCT_FOCUS = [
  'shampoo',
  'shampoos',
  'cera',
  'ceras',
  'pulidora',
  'pulidoras',
  'pulimento',
  'limpia llantas',
  'foam lance',
  'microfibra',
  'microfibras',
  'vinilo liquido',
  'vinilo líquido',
  'kit de',
  'pasta abrasiva',
];

function textHasAnySignal(text: string, signals: string[]): boolean {
  const norm = normalizeSeoText(text);
  if (!norm) return false;
  return signals.some((s) => norm.includes(normalizeSeoText(s)));
}

/** True si el copy describe el rol/catálogo del negocio (no una ficha de SKU). */
export function hasBusinessRoleSignals(...sources: Array<string | undefined | null>): boolean {
  return textHasAnySignal(sources.filter(Boolean).join(' '), BUSINESS_ROLE_SIGNALS);
}

/** Portada / mayorista / catálogo: rol de negocio o diferencial institucional. */
export function isInstitutionalBusinessCopy(...sources: Array<string | undefined | null>): boolean {
  const text = sources.filter(Boolean).join(' ');
  return (
    textHasAnySignal(text, BUSINESS_ROLE_SIGNALS) ||
    textHasAnySignal(text, DIFFERENTIAL_SIGNALS)
  );
}

/**
 * True si el título parece enfocado en UN producto concreto (malo para home/mayorista).
 * "Importación directa" sola NO lo salva: el eje sigue siendo el SKU.
 */
export function looksLikeSingleProductTitle(title: string): boolean {
  const t = normalizeSeoText(title);
  if (!t) return false;
  const hasProduct = SINGLE_PRODUCT_FOCUS.some((p) => t.includes(normalizeSeoText(p)));
  if (!hasProduct) return false;
  // Solo deja de ser "producto suelto" si habla del rol/catálogo del negocio.
  return !hasBusinessRoleSignals(title);
}

/**
 * Título de respaldo para home / hub mayorista: preserva identidad del negocio
 * (detailing + mayorista/importación) y no se achica a un solo producto.
 *
 * Importante: si el título actual YA fue contaminado con un SKU (ej. shampoo),
 * seguimos mirando meta/H1/marca para recuperar el rol del negocio.
 */
export function buildInstitutionalSeoTitle(params: {
  currentTitle?: string;
  pageH1?: string;
  pageDescription?: string;
  brandHint?: string;
  /** Home / hub: si no hay señales, asumimos catálogo (no un SKU). */
  preferCatalogFallback?: boolean;
}): string {
  const current = (params.currentTitle || '').trim();
  const h1 = (params.pageH1 || '').trim();
  const description = (params.pageDescription || '').trim();
  const brand = (params.brandHint || '').trim();

  const pool = normalizeSeoText(`${current} ${h1} ${description} ${brand}`);
  const hasMayorista = /mayorista|distribuidor/.test(pool);
  const hasImport = /importacion\s+directa/.test(pool);
  const hasDetailing = /detailing|detail\s*shop|detalle\s+automotriz|estetica\s+vehicular/.test(
    pool
  );

  let core = params.preferCatalogFallback
    ? 'Tienda Online de Productos'
    : 'Productos de Detailing';
  if (hasDetailing && hasMayorista) {
    core = 'Distribuidora Mayorista de Detailing';
  } else if (hasMayorista && hasDetailing === false && /detail/.test(pool) === false) {
    core = 'Venta Mayorista';
  } else if (hasMayorista) {
    core = 'Venta Mayorista de Detailing';
  } else if (hasDetailing) {
    // Home de un detail shop: aunque el title actual diga solo "shampoo",
    // el negocio es la tienda/distribuidora, no un SKU.
    core = params.preferCatalogFallback
      ? 'Distribuidora de Detailing'
      : 'Tienda de Car Detailing';
  } else if (params.preferCatalogFallback && brand) {
    core = brand;
  }

  const parts: string[] = [core];
  if (hasImport) parts.push('Importación Directa');
  if (
    brand &&
    !normalizeSeoText(parts.join(' ')).includes(normalizeSeoText(brand).slice(0, 12))
  ) {
    parts.push(brand);
  }

  return fitSeoTitle(parts.join(' | '), { brandHints: brand ? [brand] : [] });
}

/**
 * Si la página es home/hub y la IA (o un título ya aplicado) achica a un producto, corrige.
 *
 * Caso crítico: el dueño ya aplicó un título malo ("Shampoo…"). El title en vivo
 * pierde "distribuidora/mayorista", pero igual NO debemos reforzar el SKU.
 */
export function sanitizeHubTitleSuggestion(params: {
  suggested: string;
  currentTitle?: string;
  pageH1?: string;
  pageDescription?: string;
  brandHint?: string;
  isHubPage: boolean;
}): { title: string; corrected: boolean } {
  const suggested = (params.suggested || '').trim();
  if (!params.isHubPage || !suggested) {
    return { title: suggested, corrected: false };
  }

  const roleContext = hasBusinessRoleSignals(
    params.currentTitle,
    params.pageH1,
    params.pageDescription
  );
  const currentIsSku = looksLikeSingleProductTitle(params.currentTitle || '');
  const suggestedIsSku = looksLikeSingleProductTitle(suggested);

  const fallback = () =>
    buildInstitutionalSeoTitle({
      currentTitle: params.currentTitle,
      pageH1: params.pageH1,
      pageDescription: params.pageDescription,
      brandHint: params.brandHint,
      // En hub siempre preferimos catálogo aunque el title vivo ya esté contaminado.
      preferCatalogFallback: true,
    });

  // Nunca aceptar eje en un solo SKU en home/hub (aunque diga "importación directa").
  if (suggestedIsSku) {
    return { title: fallback(), corrected: true };
  }

  // Title vivo ya era un SKU (aplicaron mal antes) y la sugerencia no recupera el rol.
  if (currentIsSku && !hasBusinessRoleSignals(suggested)) {
    return { title: fallback(), corrected: true };
  }

  // El actual/meta tenía rol (distribuidora/mayorista) y la sugerencia lo perdió.
  if (roleContext && !hasBusinessRoleSignals(suggested)) {
    return { title: fallback(), corrected: true };
  }

  return { title: suggested, corrected: false };
}
