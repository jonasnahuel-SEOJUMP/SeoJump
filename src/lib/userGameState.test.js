import { describe, expect, it } from 'vitest';
import { sanitizeGameStatePayload } from './progression';

describe('sanitizeGameStatePayload', () => {
  it('bloquea misiones de fase 2 si la fase 1 no llegó al 70%', () => {
    const out = sanitizeGameStatePayload({
      xp: 50,
      completed_missions: ['gold-solo-una', 'fase2-create-detailing'],
      ciclos_prestigio: 0,
      gold_suggestions: Array.from({ length: 10 }, (_, i) => ({ text: `kw${i}` })),
      missions_list: [],
      gold_query: 'detailing',
      site_url: 'https://ejemplo.com',
    });

    expect(out.completed_missions).toEqual(['gold-solo-una']);
    expect(out.fase_actual).toBe(1);
  });

  it('permite fase 2 cuando hay ≥70% de gold completadas', () => {
    const suggestions = Array.from({ length: 10 }, (_, i) => ({ text: `palabra ${i}` }));
    const completed = suggestions.slice(0, 7).map((s) => `gold-${s.text}`);
    completed.push('fase2-create-detailing');

    const out = sanitizeGameStatePayload({
      xp: 200,
      completed_missions: completed,
      ciclos_prestigio: 1,
      gold_suggestions: suggestions,
      missions_list: [],
      gold_query: 'detailing',
      site_url: 'https://ejemplo.com',
    });

    expect(out.completed_missions).toContain('fase2-create-detailing');
    expect(out.fase_actual).toBeGreaterThanOrEqual(2);
    expect(out.ciclos_prestigio).toBe(1);
  });

  it('normaliza xp negativo a 0', () => {
    const out = sanitizeGameStatePayload({ xp: -10, completed_missions: [] });
    expect(out.xp).toBe(0);
  });
});
