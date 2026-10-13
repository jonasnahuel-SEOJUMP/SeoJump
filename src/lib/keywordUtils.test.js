import { describe, it, expect } from 'vitest';
import {
  isUrlLikeKeyword,
  cleanStoredKeyword,
  keywordAlreadyPresent,
  significantKeywordTokens,
  normalizeKeywordText,
} from './keywordUtils';

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

describe('keywordAlreadyPresent — misión «incluí X» ya cumplida', () => {
  it('detecta keyword en título con tildes y mayúsculas (óxido de cerio)', () => {
    expect(
      keywordAlreadyPresent('óxido de cerio', {
        title: 'Óxido de Cerio Puro 1kg | 55 Detail Shop',
        h1: '',
        slugOrUrl: 'https://www.55detailshop.com.ar/producto/cera-otra/',
      })
    ).toBe(true);
  });

  it('detecta keyword en slug aunque el título no la tenga', () => {
    expect(
      keywordAlreadyPresent('oxido de cerio', {
        title: 'Producto especial | Shop',
        h1: '',
        slugOrUrl:
          'https://www.55detailshop.com.ar/producto/oxido-de-cerio-puro-1kg/',
      })
    ).toBe(true);
  });

  it('tolera plurales básicos (pulidora / pulidoras)', () => {
    expect(
      keywordAlreadyPresent('pulidora para autos', {
        title: 'Pulidoras para autos profesionales | Shop',
        h1: 'Pulidoras',
      })
    ).toBe(true);
  });

  it('no marca cumplida si la keyword no está', () => {
    expect(
      keywordAlreadyPresent('limpia llantas', {
        title: 'Accesorios varios | Shop',
        h1: 'Accesorios',
        slugOrUrl: 'https://www.55detailshop.com.ar/categoria/accesorios-varios/',
      })
    ).toBe(false);
  });

  it('normaliza tildes en tokens', () => {
    expect(normalizeKeywordText('Óxido')).toBe('oxido');
    expect(significantKeywordTokens('óxido de cerio')).toEqual(['oxido', 'cerio']);
  });
});
