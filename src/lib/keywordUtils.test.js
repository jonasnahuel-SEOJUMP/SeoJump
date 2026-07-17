import { describe, it, expect } from 'vitest';
import { isUrlLikeKeyword, cleanStoredKeyword } from './keywordUtils';

describe('isUrlLikeKeyword', () => {
  it('detecta URLs completas con https', () => {
    expect(
      isUrlLikeKeyword('https://www.55detailshop.com.ar/producto/shampoo-luxury-foam-de-toxic-shine-lavado-premium-para-tu-auto/')
    ).toBe(true);
  });

  it('detecta URLs con http y con www sin esquema', () => {
    expect(isUrlLikeKeyword('http://miweb.com')).toBe(true);
    expect(isUrlLikeKeyword('www.miweb.com.ar')).toBe(true);
  });

  it('detecta dominios pelados sin espacios', () => {
    expect(isUrlLikeKeyword('miweb.com.ar/producto/shampoo')).toBe(true);
    expect(isUrlLikeKeyword('miweb.com')).toBe(true);
  });

  it('NO marca palabras clave normales', () => {
    expect(isUrlLikeKeyword('shampoo para autos')).toBe(false);
    expect(isUrlLikeKeyword('limpieza de tapizados')).toBe(false);
    expect(isUrlLikeKeyword('cera')).toBe(false);
  });

  it('NO marca frases con punto final o abreviaturas con espacios', () => {
    expect(isUrlLikeKeyword('shampoo premium p. autos')).toBe(false);
  });

  it('maneja vacíos y null', () => {
    expect(isUrlLikeKeyword('')).toBe(false);
    expect(isUrlLikeKeyword(null)).toBe(false);
    expect(isUrlLikeKeyword(undefined)).toBe(false);
  });
});

describe('cleanStoredKeyword', () => {
  it('devuelve la keyword intacta si es válida', () => {
    expect(cleanStoredKeyword('shampoo para autos')).toBe('shampoo para autos');
  });

  it('devuelve vacío si la keyword guardada es una URL', () => {
    expect(cleanStoredKeyword('https://www.55detailshop.com.ar/producto/shampoo/')).toBe('');
  });

  it('recorta espacios', () => {
    expect(cleanStoredKeyword('  cera para autos  ')).toBe('cera para autos');
  });

  it('devuelve vacío para null/undefined', () => {
    expect(cleanStoredKeyword(null)).toBe('');
    expect(cleanStoredKeyword(undefined)).toBe('');
  });
});
