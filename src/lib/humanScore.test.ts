import { describe, expect, it } from 'vitest';
import {
  computeHumanScore,
  humanDimensionPasses,
  hasMissionEvidence,
  humanMissionVerified,
} from './humanScore';
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

describe('hasMissionEvidence / humanMissionVerified', () => {
  it('una sola frase de experiencia no alcanza el umbral 50, pero sí evidencia de misión', () => {
    const before = emptySignals({ wordCount: 200, experienceHits: 0 });
    const after = emptySignals({ wordCount: 220, experienceHits: 2 });
    expect(humanDimensionPasses('experiencia', after)).toBe(false); // 44 < 50
    expect(hasMissionEvidence('experiencia', after)).toBe(true);

    const prevScore = 0;
    const verdict = humanMissionVerified('experiencia', after, prevScore);
    expect(verdict.passed).toBe(true);
    expect(verdict.reason).toBe('improved');
  });

  it('no marca misión si el texto no cambio respecto al analisis', () => {
    const signals = emptySignals({ wordCount: 200, experienceHits: 2 });
    // score = 44
    const verdict = humanMissionVerified('experiencia', signals, 44);
    expect(verdict.passed).toBe(false);
    expect(verdict.reason).toBe('no_change');
  });

  it('pasa por umbral si ya supera 50', () => {
    const signals = emptySignals({ wordCount: 300, experienceHits: 3 });
    const verdict = humanMissionVerified('experiencia', signals, 20);
    expect(verdict.passed).toBe(true);
    expect(verdict.reason).toBe('threshold');
  });

  it('exige evidencia concreta de casos reales', () => {
    expect(hasMissionEvidence('casosReales', emptySignals({ caseResultHits: 1 }))).toBe(true);
    expect(hasMissionEvidence('casosReales', emptySignals({}))).toBe(false);
  });
});
