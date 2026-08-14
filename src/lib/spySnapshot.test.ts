import { describe, it, expect } from 'vitest';
import { extractSpyAeoSignals, enrichSpyGaps, isProductSchemaGap } from './spySnapshot';

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
      pageType: 'page',
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
      rival,
      { ownPageType: 'page' }
    );

    expect(enriched[0].schemaCode).toContain('FAQPage');
    expect(enriched[0].schemaCode).toContain('application/ld+json');
    expect(enriched[0].requiresLiveVerify).toBe(true);
    expect(enriched[0].verifyKind).toBe('schema_faq');
    expect(enriched[0].questionsToAdd).toContain('¿Tienen seguro de carga?');
  });

  it('clasifica gap de Schema Product y no lo trata como FAQ', () => {
    expect(
      isProductSchemaGap('Schema AEO', "El competidor tiene un Schema de tipo 'Product'", 'Agregá el Schema Product')
    ).toBe(true);
    expect(isProductSchemaGap('Schema AEO', 'Le falta el Schema FAQPage', 'Agregá FAQ')).toBe(false);

    const own = {
      title: 'Cera',
      h1: 'Cera',
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
      faqQuestions: [],
      hasFaqSchema: false,
      schemaTypes: ['Product'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: "tiene Schema 'Product'", suggestion: 'Agregá Product' }],
      own,
      rival
    );
    expect(enriched[0].verifyKind).toBe('schema_product');
    expect(enriched[0].requiresLiveVerify).toBe(true);
    // No debe mostrar el mensaje de FAQ
    expect(enriched[0].schemaNote || '').not.toMatch(/preguntas visibles/i);
  });

  it('marca alreadySatisfied si el propio sitio ya tiene Schema Product (la IA se equivocó)', () => {
    const own = {
      title: 'Cera',
      h1: 'Cera',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: ['Product', 'Offer', 'WebPage'],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      hasFaqSchema: false,
      schemaTypes: ['Product'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: "tiene Schema 'Product'. Vos no lo tenés implementado.", suggestion: 'Implementá Product' }],
      own,
      rival
    );
    expect(enriched[0].alreadySatisfied).toBe(true);
    expect(enriched[0].suggestion).toBe('');
    expect(enriched[0].problem).toMatch(/ya tenés/i);
  });

  it('marca alreadySatisfied si el propio sitio ya tiene Schema FAQPage', () => {
    const own = {
      title: 'Cera',
      h1: 'Cera',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué es?'],
      faqPairs: [{ question: '¿Qué es?', answer: 'Una cera de mantenimiento en spray.' }],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage'],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué es?', '¿Cuánto dura?'],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Preguntas/FAQ Schema', problem: 'Vos no tenés Schema FAQPage', suggestion: 'Agregá FAQPage' }],
      own,
      rival,
      { ownPageType: 'page' }
    );
    expect(enriched[0].alreadySatisfied).toBe(true);
    expect(enriched[0].schemaCode).toBeUndefined();
  });

  it('marca ownUnreadable (y no afirma "no lo tenés") si no se pudo leer la página propia — Product', () => {
    const emptyOwn = {
      title: '',
      h1: '',
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
      faqQuestions: [],
      hasFaqSchema: false,
      schemaTypes: ['Product'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: "tiene Schema 'Product'", suggestion: 'Agregá Product' }],
      emptyOwn,
      rival
    );
    expect(enriched[0].verifyKind).toBe('schema_product');
    expect(enriched[0].ownUnreadable).toBe(true);
    expect(enriched[0].alreadySatisfied).toBeUndefined();
    expect(enriched[0].schemaNote).toMatch(/no pudimos leer tu página/i);
  });

  it('marca ownUnreadable si own es null — FAQ Schema', () => {
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Cuánto cuesta?'],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: 'Falta schema', suggestion: 'Agregalo' }],
      null,
      rival,
      { ownPageType: 'page' }
    );
    expect(enriched[0].verifyKind).toBe('schema_faq');
    expect(enriched[0].ownUnreadable).toBe(true);
    expect(enriched[0].schemaNote).toMatch(/no pudimos leer tu página/i);
  });

  it('no contradice: si el usuario YA tiene FAQ visibles + Schema y el rival no aporta nuevas, marca alreadySatisfied', () => {
    const own = {
      title: 'Cera',
      h1: 'Cera carnauba',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [
        '¿Qué es la cera de carnauba?',
        '¿Para qué sirve?',
        '¿Qué beneficios tiene?',
      ],
      faqPairs: [
        { question: '¿Qué es la cera de carnauba?', answer: 'Una cera natural.' },
        { question: '¿Para qué sirve?', answer: 'Da brillo y protección.' },
        { question: '¿Qué beneficios tiene?', answer: 'Brillo duradero.' },
      ],
      hasFaqSchema: true,
      schemaTypes: ['WebPage', 'FAQPage'],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [], // el competidor NO tiene preguntas visibles
      hasFaqSchema: false,
      schemaTypes: ['Organization'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Preguntas/FAQ', problem: 'Ni tu web ni la del competidor responden preguntas', suggestion: 'Agregá una sección de FAQ' }],
      own,
      rival
    );
    expect(enriched[0].alreadySatisfied).toBe(true);
    expect(enriched[0].requiresLiveVerify).toBe(false);
    expect(enriched[0].problem).toMatch(/ya tenés 3 pregunta/i);
    expect(enriched[0].suggestion).toBe('');
  });

  it('preguntas visibles sin Schema FAQPage → gap accionable con código y guía de pegado', () => {
    const own = {
      title: 'Cera carnauba',
      h1: 'Cera en pasta carnauba',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué es la cera de carnauba?', '¿Para qué sirve?'],
      faqPairs: [
        { question: '¿Qué es la cera de carnauba?', answer: 'Es una cera natural de alto brillo para pintura.' },
        { question: '¿Para qué sirve?', answer: 'Protege y realza el brillo de la pintura del auto.' },
      ],
      hasFaqSchema: false, // tiene preguntas visibles pero NO el Schema FAQPage
      schemaTypes: ['WebPage'],
      pageType: 'page',
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [], // el rival no aporta preguntas nuevas
      hasFaqSchema: false,
      schemaTypes: ['Organization'],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Preguntas/FAQ', problem: 'Ni tu web ni la del competidor responden preguntas', suggestion: 'Agregá FAQ' }],
      own,
      rival,
      { ownPageType: 'page' }
    );
    // Se vuelve accionable como Schema FAQPage (no queda como cartel muerto).
    expect(enriched[0].isSchemaGap).toBe(true);
    expect(enriched[0].schemaKind).toBe('faq');
    expect(enriched[0].verifyKind).toBe('schema_faq');
    expect(enriched[0].alreadySatisfied).toBeUndefined();
    // Código listo para pegar → la UI muestra la caja de "cómo pegar".
    expect(enriched[0].schemaCode).toContain('FAQPage');
    expect(enriched[0].schemaCode).toContain('application/ld+json');
  });

  it('si el usuario tiene FAQ pero el rival aporta preguntas nuevas, reencuadra sin decir "no tenés"', () => {
    const own = {
      title: 'Cera',
      h1: 'Cera carnauba',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué es la cera de carnauba?'],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: [],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Cuánto dura el efecto?', '¿Cada cuánto se aplica?'],
      hasFaqSchema: false,
      schemaTypes: [],
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Preguntas/FAQ', problem: 'no tenés preguntas', suggestion: 'agregá FAQ' }],
      own,
      rival
    );
    expect(enriched[0].alreadySatisfied).toBeUndefined();
    expect(enriched[0].questionsToAdd).toContain('¿Cuánto dura el efecto?');
    expect(enriched[0].problem).toMatch(/ya tenés 1 pregunta/i);
    expect(enriched[0].problem).not.toMatch(/no tenés/i);
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
      rival,
      { ownPageType: 'page' }
    );

    expect(enriched[0].schemaCode).toBeUndefined();
    expect(enriched[0].schemaNote).toMatch(/contenido visible|JSON-LD|categoría/i);
    expect(enriched[0].questionsToAdd).toEqual(['¿Cuánto cuesta?', '¿Hay garantía?']);
    expect(enriched[0].faqContentHtml).toContain('<h3>');
  });

  it('Intención/Contenido que pide agregar preguntas → verifica en vivo (no honor)', () => {
    const own = {
      title: 'Pulidoras',
      h1: 'Pulidoras',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: ['CollectionPage'],
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué pulidora necesito para empezar?'],
      hasFaqSchema: false,
      schemaTypes: [],
    };
    const enriched = enrichSpyGaps(
      [
        {
          area: 'Intención de búsqueda',
          problem: 'Tu web vende pulidoras pero no responde preguntas comunes.',
          suggestion:
            "Identificá las 3-5 preguntas más frecuentes que tus clientes te hacen sobre pulidoras (ej: '¿Qué pulidora necesito?').",
        },
      ],
      own,
      rival
    );
    expect(enriched[0].requiresLiveVerify).toBe(true);
    expect(enriched[0].verifyKind).toBe('faq_visible');
    expect(enriched[0].area).toMatch(/Preguntas/i);
    expect(enriched[0].faqContentHtml).toContain('<h3>');
    expect(enriched[0].faqContentHtml).not.toContain('<script');
  });

  it('en categoría: Schema FAQ de la IA se convierte en contenido (no FAQPage automático)', () => {
    const own = {
      title: 'Pulidoras',
      h1: 'Pulidoras',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      faqPairs: [],
      hasFaqSchema: false,
      schemaTypes: ['CollectionPage'],
      pageType: 'category',
    };
    const rival = {
      title: 'Rival pulidoras',
      h1: 'Pulidoras',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué pulidora conviene para comenzar?'],
      faqPairs: [
        {
          question: '¿Qué pulidora conviene para comenzar?',
          answer: 'Para empezar conviene una roto-orbital de entrada con pads suaves incluidos.',
        },
      ],
      hasFaqSchema: true,
      schemaTypes: ['FAQPage', 'CollectionPage'],
      pageType: 'category',
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Schema AEO', problem: 'El rival tiene FAQPage', suggestion: 'Agregá FAQPage' }],
      own,
      rival,
      { ownPageType: 'category' }
    );
    expect(enriched[0].isSchemaGap).toBeFalsy();
    expect(enriched[0].schemaCode).toBeUndefined();
    expect(enriched[0].verifyKind).toBe('faq_visible');
    expect(enriched[0].faqContentHtml).toContain('¿Qué pulidora conviene');
    expect(enriched[0].schemaNote || '').toMatch(/no hace falta FAQPage/i);
  });

  it('en categoría con FAQ visibles: no empuja Schema FAQPage', () => {
    const own = {
      title: 'Pulidoras',
      h1: 'Pulidoras',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: ['¿Qué pulidora necesito?'],
      faqPairs: [
        {
          question: '¿Qué pulidora necesito?',
          answer: 'Depende del trabajo: corrección fuerte vs mantenimiento suave del brillo.',
        },
      ],
      hasFaqSchema: false,
      schemaTypes: ['CollectionPage'],
      pageType: 'category',
    };
    const rival = {
      title: 'Rival',
      h1: 'Rival',
      headings: [],
      scrapedAt: new Date().toISOString(),
      faqQuestions: [],
      hasFaqSchema: false,
      schemaTypes: [],
      pageType: 'category',
    };
    const enriched = enrichSpyGaps(
      [{ area: 'Preguntas/FAQ', problem: 'falta FAQ', suggestion: 'agregá' }],
      own,
      rival,
      { ownPageType: 'category' }
    );
    expect(enriched[0].alreadySatisfied).toBe(true);
    expect(enriched[0].isSchemaGap).toBeFalsy();
    expect(enriched[0].schemaCode).toBeUndefined();
  });
});
