/**
 * Motor de selección inteligente de keywords y scoring de oportunidad (GSC).
 * Genérico y multi-rubro: replica el criterio de un consultor SEO — no optimizar
 * lo que ya ganás, sino atacar la keyword de intención (alta demanda + posición
 * alcanzable). Módulo puro extraído de actions.ts.
 */

/**
 * Detecta si una búsqueda es una pregunta (trigger para misiones AEO).
 * Las preguntas indican que el usuario busca una respuesta concreta —
 * exactamente el tipo de contenido que las IAs (ChatGPT, Gemini, AI Overviews)
 * prefieren citar. Agregar FAQ convierte la página en fuente ideal para la IA.
 */
export function isQuestionQuery(keyword: string): boolean {
  if (!keyword) return false;
  const kw = keyword.toLowerCase().trim();
  const questionPatterns = [
    // Español — inicio de pregunta
    'qué ', 'que ', 'cómo ', 'como ', 'cuál ', 'cual ', 'cuándo ', 'cuando ',
    'dónde ', 'donde ', 'por qué', 'para qué', 'cuánto', 'cuánta',
    // Frases dentro de la búsqueda (no solo al inicio)
    ' sirve', ' es bueno', ' es mejor', ' diferencia', ' funciona',
    ' se usa', ' se puede', ' conviene', ' recomendable', ' para qué',
    // Inglés
    'how ', 'what ', 'why ', 'when ', 'where ', 'which ', 'is it', 'can i',
    'does it', 'should i',
  ];
  return questionPatterns.some(p => kw.startsWith(p.trimStart()) || kw.includes(p));
}

/** Limpia la keyword cruda de GSC (saca $ y símbolos iniciales). */
export function cleanGscKeyword(raw: string): string {
  return (raw || '')
    .replace(/\$/g, '')
    .replace(/^[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]+/g, '')
    .trim();
}

/**
 * Peso por "zona de ataque" (striking distance). Un SEO prioriza posiciones
 * 4-20: ya están en el radar de Google y un empujón las sube al Top 3.
 * Posición 1-3 ya se ganó (poco para mejorar); >40 está demasiado lejos.
 */
export function positionOpportunityWeight(position: number): number {
  if (!position || position <= 0) return 0.5;
  if (position <= 3) return 0.18;
  if (position <= 10) return 1.0;
  if (position <= 20) return 0.85;
  if (position <= 40) return 0.4;
  return 0.12;
}

/**
 * Puntaje de oportunidad de una búsqueda. Combina DEMANDA (impresiones, en
 * escala logarítmica para no sesgar hacia un único término gigante) con cuán
 * ALCANZABLE es la posición actual. Es lo que hace que el sistema elija la
 * keyword de intención en lugar de la de marca que ya rankeás. Sirve para
 * cualquier rubro porque se basa en datos, no en nichos hardcodeados.
 */
export function opportunityScore(row: { impressions?: number; position?: number }): number {
  const impressions = row.impressions || 0;
  const position = row.position || 100;
  return Math.log10(impressions + 1) * 10 * positionOpportunityWeight(position);
}

/** Tokens de la marca del sitio (para no perseguir tu propia marca). */
export function deriveBrandTokens(siteUrl: string): string[] {
  try {
    const url = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
    const host = new URL(url).hostname.replace(/^www\./, '');
    const slug = host.split('.')[0];
    const tokens = new Set<string>();
    tokens.add(slug);
    slug.split(/[-_]/).forEach(t => t && tokens.add(t));
    return Array.from(tokens).filter(t => t.length >= 3);
  } catch {
    return [];
  }
}

/** ¿La búsqueda es básicamente solo la marca del sitio (sin término de intención)? */
export function isMostlySiteBrand(query: string, brandTokens: string[]): boolean {
  if (!brandTokens.length || !query) return false;
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const nonBrand = words.filter(w => !brandTokens.some(bt => w.includes(bt) || bt.includes(w)));
  return nonBrand.length === 0;
}
