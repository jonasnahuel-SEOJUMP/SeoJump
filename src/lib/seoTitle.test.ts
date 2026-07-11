import { describe, expect, it } from 'vitest';
import {
  MAX_SEO_TITLE_LENGTH,
  extractBrandHints,
  fitSeoTitle,
  isSeoTitleLengthOk,
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
