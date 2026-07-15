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
});
