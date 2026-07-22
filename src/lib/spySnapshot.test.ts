import { describe, it, expect } from 'vitest';
import { extractSpyAeoSignals } from './spySnapshot';

const HTML_WITH_FAQ = `
<html><head>
  <title>Pulidora Voxer</title>
  <script type="application/ld+json">
    {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"¿Cuánto dura?","acceptedAnswer":{"@type":"Answer","text":"Dura años."}}]}
  </script>
</head><body>
  <h1>Pulidora Roto Orbital</h1>
  <h2>¿Para qué sirve esta pulidora?</h2>
  <p>Sirve para corregir swirl marks y hologramas en el barniz de tu auto con seguridad.</p>
  <h2>¿Qué backing plate usa?</h2>
  <p>Usa un backing plate de 5 pulgadas compatible con la mayoría de pads del mercado.</p>
  <h2>Últimos ingresos</h2>
  <p>Producto A Producto B</p>
</body></html>`;

const HTML_PLAIN = `
<html><head><title>Home</title></head>
<body><h1>Mi tienda</h1><p>Vendemos cosas.</p></body></html>`;

describe('extractSpyAeoSignals', () => {
  it('detecta preguntas FAQ y Schema FAQPage', () => {
    const signals = extractSpyAeoSignals(HTML_WITH_FAQ);
    expect(signals.hasFaqSchema).toBe(true);
    expect(signals.schemaTypes.map((t) => t.toLowerCase())).toContain('faqpage');
    expect(signals.faqQuestions.length).toBeGreaterThanOrEqual(2);
    expect(signals.faqQuestions.some((q) => /pulidora/i.test(q))).toBe(true);
  });

  it('devuelve vacío si no hay FAQ ni Schema', () => {
    const signals = extractSpyAeoSignals(HTML_PLAIN);
    expect(signals.hasFaqSchema).toBe(false);
    expect(signals.faqQuestions).toEqual([]);
  });

  it('tolera HTML vacío', () => {
    expect(extractSpyAeoSignals('')).toEqual({
      faqQuestions: [],
      hasFaqSchema: false,
      schemaTypes: [],
    });
  });
});
