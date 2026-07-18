import { describe, expect, it } from 'vitest';
import {
  analyzeComprehension,
  buildFaqJsonLd,
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
});

describe('extractExistingStructuredData', () => {
  it('detecta FAQPage existente', () => {
    const html = `<script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script>`;
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
