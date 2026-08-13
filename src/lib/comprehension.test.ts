import { describe, expect, it } from 'vitest';
import {
  analyzeComprehension,
  buildFaqJsonLd,
  buildFaqVisibleHtml,
  extractExistingStructuredData,
  extractFaqPairs,
  extractEntities,
  detectAuthor,
  detectOrganization,
} from './comprehension';

const SAMPLE_HTML = `
<html><head>
  <title>Sellado cerámico | 55 Detail Shop</title>
  <meta name="author" content="Equipo 55 Detail Shop" />
  <meta property="article:modified_time" content="2026-01-10" />
</head>
<body class="single-post">
  <h1>¿Qué es el sellado cerámico?</h1>
  <h2>¿Qué es el sellado cerámico?</h2>
  <p>El sellado cerámico es un recubrimiento líquido que protege la laca del auto contra rayos UV y químicos agresivos del lavado.</p>
  <h2>¿Cuánto dura el tratamiento?</h2>
  <p>Un buen sellado cerámico dura entre 12 y 24 meses según el uso del vehículo y el mantenimiento.</p>
  <h2>Últimos ingresos</h2>
  <p>Añadir al carrito Vista rápida</p>
</body></html>`;

describe('extractFaqPairs', () => {
  it('extrae preguntas con respuesta y ignora carruseles', () => {
    const pairs = extractFaqPairs(SAMPLE_HTML);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
    expect(pairs[0].question).toMatch(/sellado/i);
    expect(pairs[0].answer.length).toBeGreaterThan(20);
  });

  it('detecta FAQs en negrita tipicas de WooCommerce (sin H2/H3)', () => {
    const html = `
      <div class="woocommerce-product-details__short-description">
        <p><strong>¿Para qué sirve la pulidora rotativa 3D L-36?</strong><br>
        La pulidora rotativa 3D L-36 sirve para eliminar rayas, marcas de lijado, hologramas, oxidación y defectos de la pintura.</p>
        <p><strong>¿La pulidora 3D L-36 es apta para principiantes?</strong><br>
        Puede ser utilizada por principiantes, aunque requiere práctica antes de trabajar sobre un vehículo.</p>
        <p><strong>¿Qué diferencia hay entre una pulidora rotativa y una dual action?</strong></p>
        <p>La pulidora rotativa ofrece mayor capacidad de corte y corrige defectos más rápidamente que una dual action.</p>
      </div>`;
    const pairs = extractFaqPairs(html);
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(pairs.some((p) => /principiantes/i.test(p.question))).toBe(true);
    expect(pairs.some((p) => /dual action/i.test(p.question))).toBe(true);
  });

  it('detecta FAQs con preguntas en <h4>/<h5> (no solo h2/h3)', () => {
    // Formato típico de descripción larga de WooCommerce: sección FAQ con las
    // preguntas como encabezados h4 y la respuesta en el párrafo siguiente.
    const html = `
      <h2>Preguntas frecuentes sobre la Cera en Pasta Carnauba Pure Wax Toxic Shine</h2>
      <h4>¿Qué es la Cera en Pasta Carnauba Pure Wax Toxic Shine?</h4>
      <p>La Cera en Pasta Carnauba Pure Wax Toxic Shine es una cera no abrasiva formulada con cera de carnauba y cera de abeja.</p>
      <h4>¿Para qué sirve la Cera en Pasta Carnauba Pure Wax?</h4>
      <p>Sirve para proteger la pintura, aumentar el brillo y mejorar la profundidad del color del vehículo.</p>
      <h5>¿Qué beneficios tiene la cera de carnauba?</h5>
      <p>La cera de carnauba aporta un brillo intenso, realza el color y crea una capa protectora.</p>`;
    const pairs = extractFaqPairs(html);
    expect(pairs.length).toBeGreaterThanOrEqual(3);
    expect(pairs.some((p) => /qué es la cera/i.test(p.question))).toBe(true);
    expect(pairs.some((p) => /beneficios tiene la cera/i.test(p.question))).toBe(true);
    // El título de la sección (no es pregunta) no debe contarse.
    expect(pairs.some((p) => /^preguntas frecuentes sobre/i.test(p.question))).toBe(false);
  });

  it('detecta acordeones details/summary', () => {
    const html = `
      <details><summary>¿Cuánto dura el tratamiento cerámico?</summary>
      <p>Un buen sellado cerámico dura entre 12 y 24 meses según el uso del vehículo.</p></details>`;
    const pairs = extractFaqPairs(html);
    expect(pairs.length).toBe(1);
    expect(pairs[0].question).toMatch(/dura/i);
  });

  it('detecta titulos de acordeon con clase faq-question', () => {
    const html = `
      <div class="faq-question">¿Qué pads acepta esta máquina?</div>
      <div class="faq-answer"><p>Acepta pads de 5 y 7 pulgadas con backing plate incluido de fábrica.</p></div>
      <div class="faq-question">¿Incluye maletín?</div>
      <div class="faq-answer"><p>Sí, incluye maletín rígido para transporte y almacenamiento seguro.</p></div>`;
    const pairs = extractFaqPairs(html);
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });

  it('ignora ruido de UI que parece pregunta', () => {
    const html = `<p><strong>¿Añadir al carrito?</strong><br>Vista rápida</p>`;
    const pairs = extractFaqPairs(html);
    expect(pairs.length).toBe(0);
  });
});

describe('extractExistingStructuredData', () => {
  it('detecta FAQPage existente', () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>`;
    const data = extractExistingStructuredData(html);
    expect(data.hasFaqPage).toBe(true);
  });

  it('detecta FAQPage con URL schema.org en @type', () => {
    const html = `<script type="application/ld+json">{"@type":"https://schema.org/FAQPage","mainEntity":[]}</script>`;
    const data = extractExistingStructuredData(html);
    expect(data.hasFaqPage).toBe(true);
    expect(data.typesFound).toContain('FAQPage');
  });

  it('detecta FAQPage en microdata', () => {
    const html = `<div itemscope itemtype="https://schema.org/FAQPage"><h2 itemprop="name">FAQ</h2></div>`;
    const data = extractExistingStructuredData(html);
    expect(data.hasFaqPage).toBe(true);
  });

  it('no marca FAQ si no hay', () => {
    const data = extractExistingStructuredData(SAMPLE_HTML);
    expect(data.hasFaqPage).toBe(false);
  });
});

describe('buildFaqJsonLd', () => {
  it('genera script ld+json con FAQPage', () => {
    const code = buildFaqJsonLd([
      { question: '¿Qué es X?', answer: 'X es un producto de prueba con más de veinte caracteres.' },
    ]);
    expect(code).toContain('application/ld+json');
    expect(code).toContain('FAQPage');
    expect(code).toContain('¿Qué es X?');
  });

  it('puede devolver JSON puro sin script', () => {
    const json = buildFaqJsonLd(
      [{ question: '¿Qué es X?', answer: 'X es un producto de prueba con más de veinte caracteres.' }],
      { wrapScript: false }
    );
    expect(json).not.toContain('<script');
    expect(JSON.parse(json)['@type']).toBe('FAQPage');
  });
});

describe('buildFaqVisibleHtml', () => {
  it('arma H2/H3/p sin script (apto para descripción WP)', () => {
    const html = buildFaqVisibleHtml([
      {
        question: '¿Qué pulidora necesito para empezar?',
        answer: 'Para empezar en detailing conviene una roto-orbital de 5 pulgadas con pads suaves.',
      },
    ]);
    expect(html).toContain('<h2>');
    expect(html).toContain('<h3>¿Qué pulidora necesito para empezar?</h3>');
    expect(html).toContain('<p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('FAQPage');
  });
});

describe('extractEntities / author / org', () => {
  it('detecta marca en el titulo', () => {
    const entities = extractEntities('Sellado cerámico | 55 Detail Shop', 'Sellado cerámico');
    expect(entities.some((e) => /55 Detail|Sellado/i.test(e))).toBe(true);
  });

  it('detecta autor', () => {
    expect(detectAuthor(SAMPLE_HTML).present).toBe(true);
  });

  it('detecta organizacion desde titulo', () => {
    expect(detectOrganization(SAMPLE_HTML, 'Sellado | 55 Detail Shop').present).toBe(true);
  });
});

describe('analyzeComprehension', () => {
  it('arma mapa con confianza y ofrece estructura FAQ', () => {
    const map = analyzeComprehension(SAMPLE_HTML, 'https://example.com/blog/sellado');
    expect(map.pageType).toBe('post');
    expect(map.questions.length).toBeGreaterThanOrEqual(2);
    expect(map.canOfferFaqStructure).toBe(true);
    expect(map.faqStructureAlreadyPresent).toBe(false);
    expect(map.checks.some((c) => c.id === 'author' && c.present)).toBe(true);
    expect(['bajo', 'medio', 'alto']).toContain(map.confidence);
  });

  it('no ofrece FAQ duplicado si ya hay FAQPage', () => {
    const html =
      SAMPLE_HTML +
      `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[]}</script>`;
    const map = analyzeComprehension(html, 'https://example.com/blog/sellado');
    expect(map.faqStructureAlreadyPresent).toBe(true);
    expect(map.canOfferFaqStructure).toBe(false);
  });

  it('ofrece estructura FAQ con una sola pregunta detectada', () => {
    const html = `
      <html><head><title>Shampoo Luxury Foam</title></head>
      <body>
        <h1>Shampoo Luxury Foam para autos</h1>
        <h2>¿Por qué elegir Luxury Foam para tu auto?</h2>
        <p>Su fórmula concentrada rinde entre 10 y 12 lavados completos en balde.</p>
      </body></html>`;
    const map = analyzeComprehension(html, 'https://example.com/producto/shampoo');
    expect(map.questions.length).toBe(1);
    expect(map.canOfferFaqStructure).toBe(true);
    expect(map.faqStructureAlreadyPresent).toBe(false);
    expect(map.offer?.type).toBe('faq');
  });

  it('ofrece Product schema en producto sin preguntas ni Product previo', () => {
    const html = `
      <html><head>
        <title>Microfibras por Mayor | 55 Detail Shop</title>
        <meta property="og:title" content="Microfibras por Mayor">
        <meta property="og:image" content="https://ex.com/mf.jpg">
        <meta property="product:price:amount" content="12345.00">
        <meta property="product:price:currency" content="ARS">
      </head>
      <body><h1>Microfibras por Mayor</h1><p>Importación directa.</p></body></html>`;
    const map = analyzeComprehension(html, 'https://example.com/producto/microfibras-x-mayor/');
    expect(map.pageType).toBe('product');
    expect(map.offer?.type).toBe('product');
    expect(map.offer?.code).toContain('"@type": "Product"');
    expect(map.offer?.code).toContain('12345');
    expect(map.offer?.code).toContain('ARS');
  });

  it('ofrece Article schema en post sin Article previo', () => {
    const html = `
      <html><head>
        <title>Cómo sellar tu auto | Blog</title>
        <meta property="article:published_time" content="2025-01-10">
        <meta name="author" content="Juan Pérez">
        <meta property="og:site_name" content="55 Detail Shop">
      </head>
      <body><h1>Cómo sellar tu auto paso a paso</h1><p>Guía completa.</p></body></html>`;
    const map = analyzeComprehension(html, 'https://example.com/blog/como-sellar');
    expect(map.pageType).toBe('post');
    expect(map.offer?.type).toBe('article');
    expect(map.offer?.code).toContain('"@type": "Article"');
    expect(map.offer?.code).toContain('Juan Pérez');
  });

  it('ofrece Organization schema como fallback cuando falta identidad', () => {
    const html = `
      <html><head>
        <title>Inicio | Mi Tienda</title>
        <meta property="og:site_name" content="Mi Tienda">
      </head>
      <body><h1>Bienvenidos</h1><p>Somos una tienda.</p></body></html>`;
    const map = analyzeComprehension(html, 'https://mitienda.com/');
    expect(map.offer?.type).toBe('organization');
    expect(map.offer?.code).toContain('"@type": "Organization"');
    expect(map.offer?.code).toContain('Mi Tienda');
  });

  it('no ofrece nada si ya tiene Product y Organization', () => {
    const html = `
      <html><head><title>Producto | Tienda</title></head>
      <body>
        <h1>Un producto</h1>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"X"}</script>
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Tienda"}</script>
      </body></html>`;
    const map = analyzeComprehension(html, 'https://example.com/producto/x');
    expect(map.offer).toBeNull();
  });
});
