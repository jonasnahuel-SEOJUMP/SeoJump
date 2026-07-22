import { describe, it, expect } from 'vitest';
import { extractSpyAeoSignals, enrichSpyGaps } from './spySnapshot';

const HTML_WITH_FAQ = `
<html><head>
  <title>Software de gestión</title>
  <script type="application/ld+json">
    {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"¿Cuánto dura?","acceptedAnswer":{"@type":"Answer","text":"Dura años."}}]}
  </script>
</head><body>
  <h1>Software de gestión contable</h1>
  <h2>¿Para quién es este software?</h2>
  <p>Está pensado para PyMEs que necesitan facturar y controlar stock sin complicaciones.</p>
  <h2>¿Cuánto tarda la implementación?</h2>
  <p>La mayoría de clientes queda operativo en menos de una semana con acompañamiento.</p>
  <h2>Últimos ingresos</h2>
  <p>Producto A Producto B</p>
</body></html>`;

const HTML_PLAIN = `
<html><head><title>Home</title></head>
<body><h1>Mi tienda</h1><p>Vendemos cosas.</p></body></html>`;

const HTML_FAQ_NO_SCHEMA = `
<html><head><title>Servicio logística</title></head>
<body>
  <h1>Logística nacional</h1>
  <h2>¿Hacen envíos a todo el país?</h2>
  <p>Sí, cubrimos todas las provincias con seguimiento en tiempo real del envío.</p>
  <h2>¿Cuánto tarda una entrega estándar?</h2>
  <p>Entre 24 y 72 horas hábiles según el destino y el tipo de carga.</p>
</body></html>`;

describe('extractSpyAeoSignals', () => {
  it('detecta preguntas FAQ y Schema FAQPage', () => {
    const signals = extractSpyAeoSignals(HTML_WITH_FAQ);
    expect(signals.hasFaqSchema).toBe(true);
    expect(signals.schemaTypes.map((t) => t.toLowerCase())).toContain('faqpage');
    expect(signals.faqQuestions.length).toBeGreaterThanOrEqual(2);
    expect(signals.faqPairs.length).toBe(signals.faqQuestions.length);
    expect(signals.faqQuestions.some((q) => /software/i.test(q))).toBe(true);
  });

  it('devuelve vacío si no hay FAQ ni Schema', () => {
    const signals = extractSpyAeoSignals(HTML_PLAIN);
    expect(signals.hasFaqSchema).toBe(false);
    expect(signals.faqQuestions).toEqual([]);
    expect(signals.faqPairs).toEqual([]);
  });

  it('tolera HTML vacío', () => {
    expect(extractSpyAeoSignals('')).toEqual({
      faqQuestions: [],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: [],
    });
  });
});

describe('enrichSpyGaps', () => {
  it('genera schemaCode cuando el usuario tiene FAQ visibles sin Schema', () => {
    const ownSignals = extractSpyAeoSignals(HTML_FAQ_NO_SCHEMA);
    const own = {
      title: 'Logística',
      h1: 'Logística nacional',
      headings: [],
      scrapedAt: new Date().toISOString(),
      ...ownSignals,
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Hacen envíos a todo el país?', '¿Tienen seguro de carga?'],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage'],
    };

    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: 'El rival tiene Schema', suggestion: 'Agregá FAQPage' }],
      own,
      rival
    );

    expect(enriched[0].schemaCode).toContain('FAQPage');
    expect(enriched[0].schemaCode).toContain('application/ld+json');
    expect(enriched[0].requiresLiveVerify).toBe(true);
    expect(enriched[0].verifyKind).toBe('schema_faq');
    expect(enriched[0].questionsToAdd).toContain('¿Tienen seguro de carga?');
  });

  it('no inventa schemaCode si el usuario no tiene FAQ visibles', () => {
    const own = {
      title: 'Home',
      h1: 'Home',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: [],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Cuánto cuesta?', '¿Hay garantía?'],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage'],
    };

    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: 'Falta schema', suggestion: 'Agregalo' }],
      own,
      rival
    );

    expect(enriched[0].schemaCode).toBeUndefined();
    expect(enriched[0].schemaNote).toMatch(/preguntas/i);
    expect(enriched[0].questionsToAdd).toEqual(['¿Cuánto cuesta?', '¿Hay garantía?']);
  });
});
