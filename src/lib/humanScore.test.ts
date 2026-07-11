import { describe, expect, it } from 'vitest';
import { computeHumanScore, humanDimensionPasses } from './humanScore';
import type { HumanSignals } from './scraping';

function emptySignals(overrides: Partial<HumanSignals> = {}): HumanSignals {
  return {
    wordCount: 0,
    experienceHits: 0,
    opinionHits: 0,
    limitationHits: 0,
    caseResultHits: 0,
    testimonialHits: 0,
    fluffHits: 0,
    numberHits: 0,
    percentHits: 0,
    priceHits: 0,
    yearHits: 0,
    durationHits: 0,
    imageCount: 0,
    ownImageCount: 0,
    videoCount: 0,
    tableCount: 0,
    faqPresent: false,
    ...overrides,
  };
}

describe('computeHumanScore', () => {
  it('penaliza contenido muy corto y generico', () => {
    const result = computeHumanScore(
      emptySignals({ wordCount: 40, fluffHits: 8 })
    );
    expect(result.score).toBeLessThanOrEqual(30);
    expect(result.thin).toBe(true);
    expect(result.band).toBe('bajo');
    expect(result.missions.length).toBeGreaterThan(0);
  });

  it('sube el puntaje con experiencia, evidencia y datos propios', () => {
    const result = computeHumanScore(
      emptySignals({
        wordCount: 450,
        experienceHits: 4,
        opinionHits: 3,
        limitationHits: 2,
        caseResultHits: 2,
        ownImageCount: 3,
        videoCount: 1,
        percentHits: 2,
        priceHits: 1,
        yearHits: 1,
        fluffHits: 1,
      })
    );
    expect(result.score).toBeGreaterThan(45);
    expect(result.band).not.toBe('bajo');
  });
});

describe('humanDimensionPasses', () => {
  it('detecta experiencia presente', () => {
    const signals = emptySignals({ wordCount: 300, experienceHits: 3, durationHits: 1 });
    expect(humanDimensionPasses('experiencia', signals)).toBe(true);
  });

  it('detecta evidencia ausente sin imagenes propias', () => {
    const signals = emptySignals({ wordCount: 300, imageCount: 2, ownImageCount: 0 });
    expect(humanDimensionPasses('evidencia', signals)).toBe(false);
  });
});
