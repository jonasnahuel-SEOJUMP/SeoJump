import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities } from './textUtils';

describe('decodeHtmlEntities', () => {
  it('decodifica entidades nombradas comunes de WordPress/Yoast', () => {
    expect(decodeHtmlEntities('A &#8211; B')).toBe('A - B');
    expect(decodeHtmlEntities('&ldquo;hola&rdquo;')).toBe('"hola"');
    expect(decodeHtmlEntities('it&#8217;s')).toBe("it's");
  });

  it('decodifica &#8243; (pulgadas) que aparece en títulos de productos', () => {
    expect(decodeHtmlEntities('Backing 5&#8243;')).toBe('Backing 5″');
    expect(decodeHtmlEntities('Backing 5&#x2033;')).toBe('Backing 5″');
  });

  it('decodifica entidades numéricas genéricas sin romper texto normal', () => {
    expect(decodeHtmlEntities('Vonixx Voxer 15mm')).toBe('Vonixx Voxer 15mm');
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe('');
  });
});
