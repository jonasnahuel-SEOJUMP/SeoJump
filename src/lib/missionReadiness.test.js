import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canSuggestMissionChange,
  needsVerifyReadMode,
} from './missionSafety';
import { buildSuggestedText, getMissionDisplayPlain } from './cmsGuide';

const PULIDORAS_URL =
  'https://www.55detailshop.com.ar/estetica-vehicular/maquinas-para-detailing-hidrolavadoras-aspiradoras-pulidoras-lijadoras-y-taladros/pulidoras/';

describe('canSuggestMissionChange / needsVerifyReadMode', () => {
  it('no permite cambio de título si el scrape vino vacío', () => {
    expect(canSuggestMissionChange('H1', { title: '', h1: '', fetchOk: true })).toBe(false);
    expect(needsVerifyReadMode('H1', { title: '', h1: '', fetchOk: true }, false)).toBe(true);
  });

  it('no permite cambio si fetchOk es false', () => {
    expect(needsVerifyReadMode('H1', { title: '', h1: '', fetchOk: false }, false)).toBe(true);
  });

  it('permite cambio si hay title o h1', () => {
    expect(
      canSuggestMissionChange('H1', {
        title: 'Pulidoras de Última Generación | 55 Detail Shop',
        h1: '',
      })
    ).toBe(true);
    expect(canSuggestMissionChange('H1', { title: '', h1: 'Pulidoras' })).toBe(true);
    expect(
      needsVerifyReadMode(
        'H1',
        { title: 'Pulidoras de Última Generación | 55 Detail Shop', h1: '', fetchOk: true },
        false
      )
    ).toBe(false);
  });

  it('META exige description', () => {
    expect(canSuggestMissionChange('META', { description: '' })).toBe(false);
    expect(canSuggestMissionChange('META', { description: 'Texto meta' })).toBe(true);
  });
});

describe('buildSuggestedText sin estado actual', () => {
  it('no inventa título H1 desde el slug si preview title/h1 están vacíos', () => {
    const out = buildSuggestedText(
      'H1',
      'pulidora para autos',
      PULIDORAS_URL,
      'https://www.55detailshop.com.ar',
      { title: '', h1: '', description: '', fetchOk: false }
    );
    expect(out).toBe('');
  });

  it('sí sugiere cuando hay título leído', () => {
    const out = buildSuggestedText(
      'H1',
      'pulidora para autos',
      PULIDORAS_URL,
      'https://www.55detailshop.com.ar',
      {
        title: 'Pulidoras de Última Generación para un Brillo Profesional | 55 Detail Shop',
        h1: 'Pulidoras',
        fetchOk: true,
      }
    );
    expect(out.length).toBeGreaterThan(10);
  });
});

describe('regresión Pulidoras — scrape vacío', () => {
  it('misión verify_read: display sin sugerencia de reemplazo', () => {
    const mission = {
      type: 'H1',
      mode: 'verify_read',
      page: PULIDORAS_URL,
      keyword: 'pulidora para autos',
    };
    const display = getMissionDisplayPlain(
      mission,
      'pulidora para autos',
      'https://www.55detailshop.com.ar'
    );
    expect(display.suggestedText).toBe('');
    expect(display.title.toLowerCase()).toMatch(/verificar/);
    expect(display.description.toLowerCase()).toMatch(/no pudimos leer|no sugerimos/);
  });

  it('preview vacío → verify mode (nunca sugerencia + «no detectamos» juntos)', () => {
    const emptyPreview = { title: '', h1: '', description: '', fetchOk: false };
    expect(needsVerifyReadMode('H1', emptyPreview, false)).toBe(true);
    expect(canSuggestMissionChange('H1', emptyPreview)).toBe(false);
    const invented = buildSuggestedText(
      'H1',
      'pulidora para autos',
      PULIDORAS_URL,
      'https://www.55detailshop.com.ar',
      emptyPreview
    );
    expect(invented).toBe('');
  });
});

describe('scrapeMetadata usa fetchPageHtml (fallback headless)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('propaga fetchOk true y title desde HTML útil', async () => {
    vi.doMock('./fetchPage.js', () => ({
      fetchPageHtml: vi.fn(async () => ({
        ok: true,
        html: '<html><head><title>Pulidoras | Shop</title></head><body class="tax-product_cat"><h1>Pulidoras</h1></body></html>',
      })),
    }));
    const { scrapeMetadata } = await import('./scraping.ts');
    const meta = await scrapeMetadata(PULIDORAS_URL);
    expect(meta.fetchOk).toBe(true);
    expect(meta.title).toMatch(/Pulidoras/);
    expect(meta.pageType).toBe('category');
  });

  it('fetchOk false si el fetch falla — sin inventar título', async () => {
    vi.doMock('./fetchPage.js', () => ({
      fetchPageHtml: vi.fn(async () => ({
        ok: false,
        message: 'blocked',
      })),
    }));
    const { scrapeMetadata } = await import('./scraping.ts');
    const meta = await scrapeMetadata(PULIDORAS_URL);
    expect(meta.fetchOk).toBe(false);
    expect(meta.title).toBe('');
    expect(meta.h1).toBe('');
  });
});
