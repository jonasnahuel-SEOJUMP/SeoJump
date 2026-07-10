// ═══════════════════════════════════════════════════════════════════════════
// HUMAN SCORE — Puntaje de valor humano del contenido (0-100)
// Módulo puro (sin "use server", sin IA): lo importan las server actions.
//
// Filosofía: NO es un "detector de IA". Es un detector de VALOR. Mide si el
// contenido aporta algo que una IA promedio no puede inventar (experiencia,
// evidencia, opinión, casos reales, datos propios) en lugar de castigar por
// haber usado IA. La IA optimiza; el humano aporta lo irreemplazable.
//
// El puntaje es 100% determinístico y testeable a partir de HumanSignals.
// Gemini (en actions.ts) solo enriquece las misiones con ejemplos a medida.
// ═══════════════════════════════════════════════════════════════════════════

import type { HumanSignals } from './scraping';

export type HumanDimensionId =
  | 'experiencia'
  | 'evidencia'
  | 'casosReales'
  | 'opinion'
  | 'datosPropios'
  | 'originalidad';

export type HumanDimension = {
  id: HumanDimensionId;
  label: string;
  emoji: string;
  score: number;        // 0-100
  passed: boolean;      // superó el umbral de "presente"
  summary: string;      // qué encontramos / qué falta
};

export type HumanMission = {
  id: HumanDimensionId;
  emoji: string;
  title: string;
  why: string;          // por qué suma valor (SEO/AEO/GEO)
  examples: string[];   // ejemplos concretos (determinísticos; IA los puede reemplazar)
  xp: number;
};

export type HumanScoreResult = {
  score: number;                    // 0-100
  band: 'bajo' | 'medio' | 'alto';
  headline: string;                 // frase resumen para la UI
  dimensions: HumanDimension[];
  missions: HumanMission[];         // dimensiones débiles, ordenadas por oportunidad
  wordCount: number;
  thin: boolean;                    // contenido demasiado corto para evaluar bien
};

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

/** Umbral a partir del cual una dimensión se considera "presente" en el contenido. */
const PASS_THRESHOLD = 50;

/** Peso de cada dimensión en el puntaje final (suma = 1). */
const WEIGHTS: Record<HumanDimensionId, number> = {
  experiencia: 0.24,
  evidencia: 0.18,
  casosReales: 0.16,
  opinion: 0.14,
  datosPropios: 0.14,
  originalidad: 0.14,
};

const DIMENSION_META: Record<HumanDimensionId, { label: string; emoji: string }> = {
  experiencia: { label: 'Experiencia', emoji: '👤' },
  evidencia: { label: 'Evidencia', emoji: '📸' },
  casosReales: { label: 'Casos reales', emoji: '📈' },
  opinion: { label: 'Opinión y criterio', emoji: '⭐' },
  datosPropios: { label: 'Datos propios', emoji: '🔢' },
  originalidad: { label: 'Originalidad', emoji: '✨' },
};

/** Calcula el puntaje 0-100 de cada dimensión a partir de las señales. */
function scoreDimensions(s: HumanSignals): Record<HumanDimensionId, number> {
  // Densidad de relleno por cada 100 palabras (para originalidad).
  const per100 = s.wordCount > 0 ? s.wordCount / 100 : 1;
  const fluffDensity = s.fluffHits / per100;
  const uniqueData = s.percentHits + s.priceHits + s.yearHits + s.durationHits;

  return {
    experiencia: clamp(s.experienceHits * 22 + s.durationHits * 12 + s.yearHits * 4),
    evidencia: clamp(s.ownImageCount * 18 + s.videoCount * 35 + s.tableCount * 22 + (s.imageCount - s.ownImageCount) * 5),
    casosReales: clamp(s.caseResultHits * 24 + s.testimonialHits * 18 + (s.numberHits >= 3 ? 10 : 0)),
    opinion: clamp(s.opinionHits * 20 + s.limitationHits * 24),
    datosPropios: clamp(s.percentHits * 22 + s.priceHits * 12 + s.durationHits * 12 + s.yearHits * 6 + s.numberHits * 3),
    originalidad: clamp(62 + Math.min(38, uniqueData * 5) - Math.min(70, fluffDensity * 22)),
  };
}

/** Texto resumen por dimensión según si pasó o no. */
function summarize(id: HumanDimensionId, passed: boolean, s: HumanSignals): string {
  const found: Record<HumanDimensionId, string> = {
    experiencia: 'El texto muestra experiencia propia (primera persona, aprendizajes).',
    evidencia: 'Hay evidencia propia (fotos, video o tablas).',
    casosReales: 'Aparecen casos o resultados concretos.',
    opinion: 'El contenido toma postura y da criterio.',
    datosPropios: 'Incluye datos concretos (números, fechas, precios).',
    originalidad: 'El texto evita el relleno genérico.',
  };
  const missing: Record<HumanDimensionId, string> = {
    experiencia: 'No detectamos experiencia personal ("cuando empezamos", "aprendimos", "probamos").',
    evidencia: s.imageCount > 0
      ? 'Hay imágenes, pero parecen de stock/externas. Sumá material propio.'
      : 'No hay fotos, video ni tablas propias.',
    casosReales: 'No encontramos casos reales ni resultados concretos.',
    opinion: 'El texto es neutro: no recomienda, no compara, no marca límites.',
    datosPropios: 'Faltan datos concretos (cifras, porcentajes, precios, fechas).',
    originalidad: 'Hay demasiadas frases genéricas de relleno.',
  };
  return passed ? found[id] : missing[id];
}

/** Misiones humanas por dimensión (copy + XP + ejemplos determinísticos de respaldo). */
const MISSION_BLUEPRINT: Record<HumanDimensionId, Omit<HumanMission, 'id' | 'emoji'>> = {
  experiencia: {
    title: 'Agregá una experiencia propia',
    why: 'Google (E-E-A-T) y los asistentes de IA priorizan contenido con experiencia real. Es lo primero que te diferencia de un texto genérico.',
    examples: [
      'Contá cómo empezaste: "Cuando arrancamos en 2019 cometimos el error de…"',
      'Sumá un aprendizaje: "Después de probar varias marcas, descubrimos que…"',
    ],
    xp: 25,
  },
  casosReales: {
    title: 'Mostrá un caso o resultado real',
    why: 'Un resultado concreto vale más que cinco párrafos teóricos y es lo que una IA cita como fuente confiable.',
    examples: [
      'Un antes y después: "Este cliente pasó de 18 a 220 visitas por mes".',
      'Un caso propio: "A un taller de Córdoba le resolvimos X en 3 semanas".',
    ],
    xp: 25,
  },
  datosPropios: {
    title: 'Incluí datos concretos',
    why: 'Los motores generativos (ChatGPT, Perplexity, Gemini) prefieren citar contenido con cifras propias antes que afirmaciones vagas.',
    examples: [
      'Un dato tuyo: "El 70% de los autos que atendemos llegan con rayones leves".',
      'Precios/tiempos reales: "El servicio tarda 2 horas y cuesta desde $X".',
    ],
    xp: 20,
  },
  evidencia: {
    title: 'Sumá una foto, video o tabla propia',
    why: 'La evidencia visual propia hace el contenido más útil y creíble, y es imposible de copiar por otro sitio.',
    examples: [
      'Una foto tuya trabajando o del resultado (no de stock).',
      'Una tabla comparativa o una captura de un resultado real.',
    ],
    xp: 15,
  },
  opinion: {
    title: 'Dá tu opinión y marcá límites',
    why: 'La IA casi nunca opina ni admite límites. Cuando lo hacés, generás confianza y te volvés una fuente con criterio.',
    examples: [
      'Tomá postura: "Preferimos X sobre Y porque…".',
      'Marcá un límite: "No recomendamos esto si tu caso es…".',
    ],
    xp: 15,
  },
  originalidad: {
    title: 'Eliminá frases genéricas',
    why: 'El relleno tipo "es importante" o "en la actualidad" no aporta nada y hace que tu contenido se parezca a los otros 100 resultados.',
    examples: [
      'Reemplazá "es muy importante" por un dato o un ejemplo concreto.',
      'Sacá introducciones vacías y arrancá respondiendo directo.',
    ],
    xp: 10,
  },
};

/** Verifica si una dimensión puntual ya está "presente" según las señales (para misiones). */
export function humanDimensionPasses(id: HumanDimensionId, s: HumanSignals): boolean {
  const scores = scoreDimensions(s);
  return scores[id] >= PASS_THRESHOLD;
}

/**
 * Calcula el Human Score completo a partir de las señales determinísticas.
 * No usa IA. Devuelve puntaje, dimensiones y misiones para las dimensiones débiles.
 */
export function computeHumanScore(s: HumanSignals): HumanScoreResult {
  const thin = s.wordCount < 120;
  const rawScores = scoreDimensions(s);

  const order: HumanDimensionId[] = ['experiencia', 'evidencia', 'casosReales', 'opinion', 'datosPropios', 'originalidad'];

  const dimensions: HumanDimension[] = order.map((id) => {
    const score = Math.round(rawScores[id]);
    const passed = score >= PASS_THRESHOLD;
    return {
      id,
      label: DIMENSION_META[id].label,
      emoji: DIMENSION_META[id].emoji,
      score,
      passed,
      summary: summarize(id, passed, s),
    };
  });

  let total = order.reduce((sum, id) => sum + rawScores[id] * WEIGHTS[id], 0);
  // Penalización por contenido muy corto: no se puede demostrar valor en 2 líneas.
  if (s.wordCount < 80) total = Math.min(total, 30);
  else if (thin) total = total * 0.75;
  const score = Math.round(clamp(total));

  const band: HumanScoreResult['band'] = score >= 70 ? 'alto' : score >= 45 ? 'medio' : 'bajo';

  const headline =
    band === 'alto'
      ? 'Tu contenido tiene sello humano. Difícil de copiar y fácil de citar.'
      : band === 'medio'
        ? 'Tu contenido está encaminado, pero le falta valor humano para destacar.'
        : 'Tu contenido parece poco humano: está técnicamente bien, pero es genérico.';

  // Misiones: dimensiones que no pasaron, de la más floja a la menos floja.
  const missions: HumanMission[] = dimensions
    .filter((d) => !d.passed)
    .sort((a, b) => a.score - b.score)
    .map((d) => ({
      id: d.id,
      emoji: d.emoji,
      ...MISSION_BLUEPRINT[d.id],
    }));

  return { score, band, headline, dimensions, missions, wordCount: s.wordCount, thin };
}
