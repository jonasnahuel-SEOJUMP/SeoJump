/**
 * Guías para instalar datos estructurados según el editor real del usuario.
 * Se separa "plataforma" de "editor" porque WordPress puede usar Gutenberg,
 * el editor clásico o un constructor visual.
 */

export const SCHEMA_INSTALL_METHODS = [
  { id: 'wp_blocks', label: 'WordPress — Editor de bloques', shortLabel: 'Bloques', icon: '🧱', group: 'wp' },
  { id: 'wp_classic', label: 'WordPress — Editor clásico', shortLabel: 'Clásico', icon: '📝', group: 'wp' },
  { id: 'wp_builder', label: 'WordPress — Elementor / Divi / maquetador', shortLabel: 'Maquetador', icon: '🎨', group: 'wp' },
  { id: 'shopify', label: 'Shopify', shortLabel: 'Shopify', icon: '🛍️', group: 'other' },
  { id: 'tiendanube', label: 'Tiendanube', shortLabel: 'Tiendanube', icon: '☁️', group: 'other' },
  { id: 'other', label: 'Otra plataforma / No sé', shortLabel: 'Otra', icon: '❓', group: 'other' },
];

export const SCHEMA_PASTE_BLOG_HREF = '/blog/donde-pegar-codigo-schema-wordpress-shopify';

const STORAGE_KEY = 'seojump_schema_install_method';
const VALID_METHODS = new Set(SCHEMA_INSTALL_METHODS.map((method) => method.id));

const WP_METHODS = new Set(['wp_blocks', 'wp_classic', 'wp_builder']);

function isCompatibleWithPlatform(methodId, platformId) {
  if (!platformId) return true;
  if (platformId === 'wp' || platformId === 'wp_woo') return methodId.startsWith('wp_');
  if (platformId === 'shopify') return methodId === 'shopify';
  if (platformId === 'tiendanube') return methodId === 'tiendanube';
  if (platformId === 'other') return methodId === 'other';
  return true;
}

export function suggestedSchemaInstallMethod(platformId = '') {
  if (platformId === 'shopify') return 'shopify';
  if (platformId === 'tiendanube') return 'tiendanube';
  if (platformId === 'other') return 'other';
  // No adivinar el editor de WordPress: elegir mal es la causa del bloqueo.
  return '';
}

export function getStoredSchemaInstallMethod(platformId = '') {
  if (typeof window === 'undefined') return suggestedSchemaInstallMethod(platformId);
  const stored = localStorage.getItem(STORAGE_KEY) || '';
  return VALID_METHODS.has(stored) && isCompatibleWithPlatform(stored, platformId)
    ? stored
    : suggestedSchemaInstallMethod(platformId);
}

export function setStoredSchemaInstallMethod(methodId) {
  if (typeof window === 'undefined' || !VALID_METHODS.has(methodId)) return;
  localStorage.setItem(STORAGE_KEY, methodId);
}

/**
 * Heurística suave: señales en el HTML público. Nunca fuerza Editor Clásico
 * (casi no deja huella). Prioridad: maquetador > bloques > Shopify.
 *
 * @param {string} html
 * @returns {{ suggestedMethod: string|null, confidence: 'alta'|'media'|'baja'|null, reasons: string[] }}
 */
export function detectSchemaInstallHints(html) {
  const raw = String(html || '');
  const lower = raw.toLowerCase();
  const reasons = [];

  const hasBuilder =
    /elementor|data-elementor|elementor-widget|et_pb_|et-pb-|flatsome|theme-flatsome|\[ux_|ux_banner|ux-builder|wpb_wrapper|vc_row|fusion-builder|oxygen-body/i.test(
      raw
    );
  if (hasBuilder) {
    if (/elementor|data-elementor/i.test(raw)) reasons.push('Marcas de Elementor en el HTML');
    if (/et_pb_|et-pb-/i.test(raw)) reasons.push('Marcas de Divi en el HTML');
    if (/flatsome|\[ux_|ux_banner|ux-builder/i.test(raw)) {
      reasons.push('Shortcodes o tema tipo Flatsome (ej. [ux_banner])');
    }
    if (/wpb_wrapper|vc_row/i.test(raw)) reasons.push('Marcas de WPBakery / Visual Composer');
    if (/fusion-builder|oxygen-body/i.test(raw)) reasons.push('Constructor visual detectado');
    return {
      suggestedMethod: 'wp_builder',
      confidence: reasons.length >= 2 ? 'alta' : 'media',
      reasons,
    };
  }

  const hasBlocks =
    /wp-block-|is-root-container|wp-block-group|wp-block-columns|wp-block-cover|has-global-padding/i.test(
      raw
    );
  if (hasBlocks) {
    reasons.push('Clases típicas del Editor de bloques (Gutenberg)');
    return {
      suggestedMethod: 'wp_blocks',
      confidence: 'media',
      reasons,
    };
  }

  const hasShopify =
    /cdn\.shopify\.com|shopify\.com\/s\/|myshopify\.com|Shopify\.theme|shopify-section/i.test(raw) ||
    /<meta[^>]+name=["']generator["'][^>]+content=["'][^"']*shopify/i.test(lower);
  if (hasShopify) {
    reasons.push('Señales de Shopify en el HTML');
    return {
      suggestedMethod: 'shopify',
      confidence: 'alta',
      reasons,
    };
  }

  return { suggestedMethod: null, confidence: null, reasons: [] };
}

/**
 * Resuelve qué editor mostrar al abrir el resultado de un análisis.
 * - Si hay hint de página y el stored lo contradice (ej. Clásico vs bloques), NO auto-aplica stored.
 * - Si stored es compatible con el hint (mismo o sin hint), usa stored.
 * - Si no hay stored, usa el hint o la sugerencia de plataforma.
 *
 * @returns {{
 *   method: string,
 *   conflict: boolean,
 *   conflictMessage: string|null,
 *   suggestedMethod: string|null,
 * }}
 */
export function resolveSchemaInstallMethod({
  platformId = '',
  storedMethod = '',
  editorHint = null,
} = {}) {
  const suggested =
    editorHint?.suggestedMethod && VALID_METHODS.has(editorHint.suggestedMethod)
      ? editorHint.suggestedMethod
      : null;

  const stored =
    storedMethod && VALID_METHODS.has(storedMethod) && isCompatibleWithPlatform(storedMethod, platformId)
      ? storedMethod
      : '';

  const platformFallback = suggestedSchemaInstallMethod(platformId);

  const conflicts =
    !!(suggested && stored && suggested !== stored && WP_METHODS.has(suggested) && WP_METHODS.has(stored));

  if (conflicts) {
    const storedLabel =
      SCHEMA_INSTALL_METHODS.find((m) => m.id === stored)?.shortLabel || stored;
    const suggestedLabel =
      SCHEMA_INSTALL_METHODS.find((m) => m.id === suggested)?.shortLabel || suggested;
    return {
      method: '',
      conflict: true,
      conflictMessage: `Antes elegiste Editor ${storedLabel}; esta página parece usar ${suggestedLabel}. Cambiá el tab si no ves Visual/Código.`,
      suggestedMethod: suggested,
    };
  }

  if (stored) {
    return {
      method: stored,
      conflict: false,
      conflictMessage: null,
      suggestedMethod: suggested,
    };
  }

  if (suggested) {
    return {
      method: suggested,
      conflict: false,
      conflictMessage: null,
      suggestedMethod: suggested,
    };
  }

  return {
    method: platformFallback || '',
    conflict: false,
    conflictMessage: null,
    suggestedMethod: null,
  };
}

const GUIDES = {
  wp_blocks: {
    title: 'WordPress con Editor de bloques (Gutenberg)',
    recognition:
      'Elegí esta opción si editás la página agregando bloques con el botón “+”. Incluye muchas páginas de inicio modernas.',
    steps: [
      'En WordPress, abrí **la misma página que analizaste** (también vale la home) y tocá **Editar**.',
      'Bajá hasta el **final del contenido** de la página.',
      'Hacé clic en el botón **+** (Añadir bloque).',
      'Buscá y seleccioná el bloque **HTML personalizado** (también podés escribir **/html**).',
      'Tocá **Copiar código** en SEO Jump y pegalo completo dentro de ese bloque, sin editarlo.',
      'Tocá **Actualizar** o **Publicar**. Si usás caché, borrala.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
    note:
      'Si en el editor ves códigos tipo **[ux_banner]** y no el botón +, esta página usa un maquetador: cambiá a la pestaña **Elementor / Divi / maquetador** o leé la guía completa del blog.',
  },
  wp_classic: {
    title: 'WordPress con Editor clásico',
    recognition:
      'Elegí esta opción si arriba del contenido ves las pestañas “Visual” y “Texto” o “Código”.',
    steps: [
      'En WordPress, abrí **la misma página o producto que analizaste** y tocá **Editar**.',
      'Ubicá el editor del contenido principal. En un producto, evitá confundirlo con la **descripción corta**.',
      'Arriba a la derecha del editor, cambiá de **Visual** a **Texto** o **Código**.',
      'Andá hasta el final, dejá una línea vacía y pegá el código completo que copiaste de SEO Jump.',
      'Tocá **Actualizar**. Si usás caché, borrala.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
    note:
      'Si no ves las pestañas Visual/Código (muy común en la home), esta página probablemente usa **bloques** o un **maquetador**. Cambiá de pestaña arriba.',
  },
  wp_builder: {
    title: 'WordPress con Elementor, Divi, Flatsome u otro maquetador',
    recognition:
      'Elegí esta opción si abrís la página con “Editar con Elementor”, Divi, UX Builder / Flatsome, o ves shortcodes tipo [ux_banner].',
    steps: [
      'En WordPress, abrí **la misma página que analizaste** con tu constructor visual (Elementor, Divi, UX Builder, etc.).',
      'Agregá al final un elemento **HTML** (Elementor), **Código** (Divi) o el bloque de código personalizado de tu maquetador. No uses un elemento de texto.',
      'Tocá **Copiar código** en SEO Jump y pegalo completo dentro de ese elemento.',
      'Guardá con **Actualizar** o **Publicar** y borrá la caché si corresponde.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
    warning:
      'Si estás editando una plantilla global que se usa en muchos productos o páginas, no pegues un código específico allí: aparecería repetido con datos incorrectos. Editá solo esa página o pedí ayuda a quien administra tu plantilla.',
  },
  shopify: {
    title: 'Shopify',
    recognition:
      'En Shopify, una plantilla puede compartirse entre muchos productos. Primero asegurate de trabajar solo sobre la página analizada.',
    steps: [
      'Entrá a **Tienda online → Temas → Personalizar**.',
      'Desde el selector superior, abrí el tipo de página que analizaste (producto, página o artículo).',
      'Si esa plantilla también se usa en otras páginas, creá una **plantilla nueva** y asignala únicamente a la página analizada.',
      'Dentro de esa plantilla, tocá **Agregar sección → Liquid personalizado**.',
      'Pegá el código completo de SEO Jump, guardá y comprobá que la plantilla correcta esté asignada.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
    warning:
      'No pegues un código específico de producto o artículo directamente en theme.liquid: podría publicarse en todo el sitio y describir páginas equivocadas.',
  },
  tiendanube: {
    title: 'Tiendanube',
    recognition:
      'Tiendanube no siempre permite agregar HTML distinto en cada producto o página; depende del tema y del plan.',
    steps: [
      'Abrí en Tiendanube **la misma página, producto o contenido que analizaste**.',
      'Buscá en su editor una opción de **HTML**, **código personalizado** o una app de datos estructurados.',
      'Si permite código solo para esa página, pegá allí el bloque completo de SEO Jump y guardá.',
      'Si la única opción disponible dice **códigos externos** o se aplica a toda la tienda, no pegues ahí un código específico de producto.',
      'En ese caso, enviá el código al soporte de Tiendanube, a tu diseñador o usá una app compatible para instalarlo únicamente donde corresponde.',
      'Cuando esté publicado, volvé a SEO Jump y tocá **Ya lo pegué**.',
    ],
    warning:
      'Los menús disponibles cambian según el tema y el plan. Es preferible pedir ayuda antes que repetir los datos de una sola página en toda la tienda.',
  },
  other: {
    title: 'Otra plataforma o editor',
    recognition:
      'La ubicación cambia según la herramienta, pero la regla principal siempre es la misma: el código debe aparecer solo en la página analizada.',
    steps: [
      'Abrí el editor de **la misma página que analizaste**.',
      'Buscá una opción llamada **HTML**, **Código**, **Embed** o **Código personalizado**.',
      'Pegá el bloque completo de SEO Jump, sin modificarlo, y publicá los cambios.',
      'Si el código se aplicaría a todo el sitio, no lo pegues: pedí a tu diseñador que lo agregue solo a esa página.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
    warning:
      'Si no encontrás una opción por página, mandale el código a quien administra tu web. No hace falta que lo edite: solo debe instalarlo en la URL indicada.',
  },
};

export function getSchemaPasteGuide(methodId) {
  return GUIDES[methodId] || null;
}

export function getMethodLabel(methodId) {
  return SCHEMA_INSTALL_METHODS.find((m) => m.id === methodId)?.label || methodId || '';
}
