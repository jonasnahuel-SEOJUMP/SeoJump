import { describe, expect, it } from 'vitest';
import {
  MAX_SEO_TITLE_LENGTH,
  buildInstitutionalSeoTitle,
  extractBrandHints,
  fitSeoTitle,
  hasBusinessRoleSignals,
  isInstitutionalBusinessCopy,
  isSeoTitleLengthOk,
  looksLikeSingleProductTitle,
  sanitizeHubTitleSuggestion,
} from './seoTitle';

describe('isSeoTitleLengthOk', () => {
  it('acepta titulos dentro del limite Yoast', () => {
    expect(isSeoTitleLengthOk('Shampoos para auto y motos - Venta Mayorista')).toBe(true);
  });

  it('rechaza titulos por encima de 60 caracteres', () => {
    const long =
      'Shampoo para Autos y Motos | Venta Mayorista y Minorista | 55 Detail Shop';
    expect(long.length).toBeGreaterThan(MAX_SEO_TITLE_LENGTH);
    expect(isSeoTitleLengthOk(long)).toBe(false);
  });
});

describe('fitSeoTitle', () => {
  it('devuelve el titulo sin cambios si ya entra en 60 chars', () => {
    const title = 'Shampoos para auto y motos - Venta Mayorista';
    expect(fitSeoTitle(title)).toBe(title);
  });

  it('quita el sufijo de tienda antes de truncar (caso 55 Detail Shop)', () => {
    const long =
      'Shampoo para Autos y Motos | Venta Mayorista y Minorista | 55 Detail Shop';
    const result = fitSeoTitle(long, {
      brandHints: extractBrandHints(long),
    });
    expect(result.length).toBeLessThanOrEqual(MAX_SEO_TITLE_LENGTH);
    expect(result).toBe('Shampoo para Autos y Motos | Venta Mayorista y Minorista');
    expect(result).not.toContain('55 Detail Shop');
  });

  it('quita el ultimo segmento pipe si no hay brand hint', () => {
    const long = 'Foam Lance con Acople | Accesorio Detailing | Tienda Online Demo';
    const result = fitSeoTitle(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SEO_TITLE_LENGTH);
    expect(result).not.toContain('Tienda Online Demo');
  });

  it('trunca por palabra si sigue siendo largo', () => {
    const long =
      'Pintura de retoque para autos con pincel profesional importada directa desde fabrica';
    const result = fitSeoTitle(long);
    expect(result.length).toBeLessThanOrEqual(MAX_SEO_TITLE_LENGTH);
    expect(result).not.toMatch(/\s$/);
  });
});

describe('extractBrandHints', () => {
  it('extrae la marca al final del titulo', () => {
    const hints = extractBrandHints(
      'Autopint: Pintura de Retoque | 55 Detail Shop',
      'Shampoo Luxury Foam | Toxic Shine'
    );
    expect(hints).toContain('55 Detail Shop');
    expect(hints).toContain('Toxic Shine');
  });
});

describe('hub / mayorista title safety', () => {
  const current =
    'Distribuidora mayorista de productos de Detailing - Importación directa - 55 Detail Shop';

  it('detecta rol de negocio vs diferencial suelto', () => {
    expect(hasBusinessRoleSignals(current)).toBe(true);
    expect(hasBusinessRoleSignals('Importación Directa y Calidad')).toBe(false);
    expect(isInstitutionalBusinessCopy('Importación Directa y Calidad')).toBe(true);
  });

  it('marca shampoo+importacion como producto suelto (caso real 55 Detail Shop)', () => {
    const bad = 'Shampoo para Autos por Mayor | Importación Directa y Calidad';
    expect(looksLikeSingleProductTitle(bad)).toBe(true);
    expect(hasBusinessRoleSignals(bad)).toBe(false);
  });

  it('no marca como producto suelto un titulo de distribuidora', () => {
    expect(
      looksLikeSingleProductTitle('Distribuidora Mayorista de Detailing | Importación Directa')
    ).toBe(false);
  });

  it('corrige sugerencia de shampoo en home/hub mayorista', () => {
    const bad = 'Shampoo para Autos por Mayor | Importación Directa y Calidad';
    const result = sanitizeHubTitleSuggestion({
      suggested: bad,
      currentTitle: current,
      pageH1: '55 Detail Shop',
      brandHint: '55 Detail Shop',
      isHubPage: true,
    });
    expect(result.corrected).toBe(true);
    expect(result.title.toLowerCase()).not.toContain('shampoo');
    expect(hasBusinessRoleSignals(result.title)).toBe(true);
    expect(result.title.length).toBeLessThanOrEqual(MAX_SEO_TITLE_LENGTH);
  });

  it('corrige aunque el title vivo YA esté contaminado con shampoo (post-aplicar)', () => {
    const contaminated =
      'Shampoo para Autos por Mayor | Importación Directa y Calidad';
    const result = sanitizeHubTitleSuggestion({
      suggested: contaminated,
      currentTitle: contaminated,
      pageH1: '55 Detail Shop',
      pageDescription:
        'Distribuidora mayorista de productos de detailing. Importación directa.',
      brandHint: '55 Detail Shop',
      isHubPage: true,
    });
    expect(result.corrected).toBe(true);
    expect(result.title.toLowerCase()).not.toContain('shampoo');
    expect(result.title.toLowerCase()).toMatch(/detailing|mayorista|distribuidora/);
  });

  it('en home sin meta de rol igual rechaza SKU usando la marca Detail Shop', () => {
    const contaminated = 'Shampoo para Autos por Mayor | Importación Directa';
    const result = sanitizeHubTitleSuggestion({
      suggested: contaminated,
      currentTitle: contaminated,
      brandHint: '55 Detail Shop',
      isHubPage: true,
    });
    expect(result.corrected).toBe(true);
    expect(result.title.toLowerCase()).not.toContain('shampoo');
  });

  it('corrige si pierde mayorista/distribuidora aunque no diga un SKU', () => {
    const result = sanitizeHubTitleSuggestion({
      suggested: 'Detailing Automotriz | Importación Directa',
      currentTitle: current,
      brandHint: '55 Detail Shop',
      isHubPage: true,
    });
    expect(result.corrected).toBe(true);
    expect(hasBusinessRoleSignals(result.title)).toBe(true);
  });

  it('no toca sugerencias de fichas de producto (no hub)', () => {
    const productTitle = 'Shampoo Luxury Foam | Toxic Shine';
    const result = sanitizeHubTitleSuggestion({
      suggested: productTitle,
      currentTitle: productTitle,
      isHubPage: false,
    });
    expect(result.corrected).toBe(false);
    expect(result.title).toBe(productTitle);
  });

  it('buildInstitutionalSeoTitle preserva mayorista e importacion', () => {
    const title = buildInstitutionalSeoTitle({
      currentTitle: current,
      brandHint: '55 Detail Shop',
    });
    expect(title.toLowerCase()).toMatch(/mayorista|distribuidora/);
    expect(title.toLowerCase()).toMatch(/importaci/);
    expect(title.length).toBeLessThanOrEqual(MAX_SEO_TITLE_LENGTH);
  });
});
