import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchPageHtml, htmlLooksUseful } from './fetchPage.js';

vi.mock('./safeHttp.js', () => ({
  fetchHtmlSafe: vi.fn(),
}));

import { fetchHtmlSafe } from './safeHttp.js';

describe('htmlLooksUseful', () => {
  it('rechaza vacío / muy corto', () => {
    expect(htmlLooksUseful('')).toBe(false);
    expect(htmlLooksUseful('<html></html>')).toBe(false);
  });

  it('acepta página con title o H1', () => {
    expect(
      htmlLooksUseful(
        '<html><head><title>Mi tienda de detailing</title></head><body><p>hola</p></body></html>'
      )
    ).toBe(true);
    expect(
      htmlLooksUseful(
        '<html><head></head><body><h1>ESTETICA VEHICULAR</h1><p>productos</p></body></html>'
      )
    ).toBe(true);
  });

  it('rechaza challenge Cloudflare típico', () => {
    expect(
      htmlLooksUseful(
        '<html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue</body></html>'
      )
    ).toBe(false);
    expect(
      htmlLooksUseful(
        '<html><head><title>Attention Required! | Cloudflare</title></head><body><div id="cf-browser-verification"></div></body></html>'
      )
    ).toBe(false);
  });
});

describe('fetchPageHtml browser fallback', () => {
  beforeEach(() => {
    vi.mocked(fetchHtmlSafe).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa el camino rápido si el HTML es útil (no llama al headless)', async () => {
    const browserFetch = vi.fn();
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      ok: true,
      html: '<!DOCTYPE html><html><head><title>OK Shop Detailing Mayorista</title></head><body><h1>Home</h1><p>Productos de estética vehicular</p></body></html>',
      finalUrl: 'https://example.com/',
    });

    const res = await fetchPageHtml('https://example.com/', { browserFetch });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.html).toMatch(/OK Shop/);
    expect(browserFetch).not.toHaveBeenCalled();
  });

  it('llama al camino headless si el fetch rápido falla', async () => {
    const browserFetch = vi.fn(async () => ({
      ok: true,
      html: '<html><head><title>Desde navegador</title></head><body><h1>OK</h1></body></html>',
      finalUrl: 'https://blocked.example/',
    }));
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      ok: false,
      message: 'No pude acceder a la página (Error 403). Verificá que la URL sea pública.',
    });

    const res = await fetchPageHtml('https://blocked.example/', { browserFetch });
    expect(browserFetch).toHaveBeenCalledTimes(1);
    expect(browserFetch.mock.calls[0][0]).toBe('https://blocked.example/');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.html).toMatch(/Desde navegador/);
  });

  it('llama al headless si el HTML rápido parece un challenge Cloudflare', async () => {
    const browserFetch = vi.fn(async () => ({
      ok: true,
      html: '<html><head><title>Tienda real</title></head><body><h1>Productos</h1></body></html>',
    }));
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      ok: true,
      html: '<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>',
    });

    const res = await fetchPageHtml('https://cf.example/', { browserFetch });
    expect(browserFetch).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.html).toMatch(/Tienda real/);
  });

  it('si ambos fallan, devuelve el error del camino rápido', async () => {
    const browserFetch = vi.fn(async () => ({
      ok: false,
      message: 'Error al acceder a la página con navegador: boom',
    }));
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      ok: false,
      message: 'No pude acceder a la página (Error 403). Verificá que la URL sea pública.',
    });

    const res = await fetchPageHtml('https://dead.example/', { browserFetch });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/403/);
    }
  });

  it('no intenta headless si browserFallback=false', async () => {
    const browserFetch = vi.fn();
    vi.mocked(fetchHtmlSafe).mockResolvedValue({
      ok: false,
      message: 'No pude acceder a la página (Error 403). Verificá que la URL sea pública.',
    });

    const res = await fetchPageHtml('https://blocked.example/', {
      browserFetch,
      browserFallback: false,
    });
    expect(browserFetch).not.toHaveBeenCalled();
    expect(res.ok).toBe(false);
  });
});
