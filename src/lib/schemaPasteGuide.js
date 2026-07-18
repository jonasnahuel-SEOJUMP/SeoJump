/**
 * Guías para instalar datos estructurados según el editor real del usuario.
 * Se separa "plataforma" de "editor" porque WordPress puede usar Gutenberg,
 * el editor clásico o un constructor visual.
 */

export const SCHEMA_INSTALL_METHODS = [
  { id: 'wp_blocks', label: 'WordPress — Editor de bloques', icon: '🧱' },
  { id: 'wp_classic', label: 'WordPress — Editor clásico', icon: '📝' },
  { id: 'wp_builder', label: 'WordPress — Elementor / Divi', icon: '🎨' },
  { id: 'shopify', label: 'Shopify', icon: '🛍️' },
  { id: 'tiendanube', label: 'Tiendanube', icon: '☁️' },
  { id: 'other', label: 'Otra plataforma / No sé', icon: '❓' },
];

const STORAGE_KEY = 'seojump_schema_install_method';
const VALID_METHODS = new Set(SCHEMA_INSTALL_METHODS.map((method) => method.id));

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

const GUIDES = {
  wp_blocks: {
    title: 'WordPress con Editor de bloques (Gutenberg)',
    recognition:
      'Elegí esta opción si editás la página agregando bloques con el botón “+”.',
    steps: [
      'En WordPress, abrí **la misma página o producto que analizaste** y tocá **Editar**.',
      'Bajá hasta el final del contenido principal y presioná el botón **+** para agregar un bloque.',
      'Buscá **HTML personalizado** (también podés escribir **/html**) y elegí ese bloque.',
      'Tocá **Copiar código** en SEO Jump y pegalo completo dentro del bloque, sin editarlo.',
      'Tocá **Actualizar** o **Publicar**. Si usás caché, borrala.',
      'Volvé a SEO Jump y tocá **Ya lo pegué** para comprobarlo.',
    ],
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
  },
  wp_builder: {
    title: 'WordPress con Elementor, Divi u otro constructor',
    recognition:
      'Elegí esta opción si abrís la página con un botón como “Editar con Elementor” o “Usar Divi”.',
    steps: [
      'En WordPress, abrí **la misma página que analizaste** con tu constructor visual.',
      'Agregá al final un elemento **HTML** (Elementor) o **Código** (Divi). No uses un elemento de texto.',
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
