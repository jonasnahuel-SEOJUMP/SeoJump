import { describe, it, expect } from 'vitest';
import { extractFromHtml } from './pageContent';

describe('extractFromHtml H1 = solo Título SEO', () => {
  it('devuelve el <title> y no el H1 visual', () => {
    const html = `
      <html><head><title>Pulidoras para autos | Shop</title></head>
      <body><h1>Nombre corto de categoría</h1><h2>Otro</h2></body></html>
    `;
    const values = extractFromHtml(html, 'H1');
    expect(values).toEqual(['Pulidoras para autos | Shop']);
  });

  it('null si no hay <title>', () => {
    const html = `<html><body><h1>Solo H1 visual</h1></body></html>`;
    expect(extractFromHtml(html, 'H1')).toBeNull();
  });
});
