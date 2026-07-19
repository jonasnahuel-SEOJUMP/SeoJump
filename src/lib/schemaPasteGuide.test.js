import { describe, expect, it } from 'vitest';
import {
  SCHEMA_INSTALL_METHODS,
  detectSchemaInstallHints,
  getSchemaPasteGuide,
  resolveSchemaInstallMethod,
  suggestedSchemaInstallMethod,
} from './schemaPasteGuide';

describe('schemaPasteGuide', () => {
  it('incluye una guía completa para cada editor disponible', () => {
    for (const method of SCHEMA_INSTALL_METHODS) {
      const guide = getSchemaPasteGuide(method.id);
      expect(guide).not.toBeNull();
      expect(guide.title).toBeTruthy();
      expect(guide.recognition).toBeTruthy();
      expect(guide.steps.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('no adivina qué editor usa WordPress solo por plataforma', () => {
    expect(suggestedSchemaInstallMethod('wp')).toBe('');
    expect(suggestedSchemaInstallMethod('wp_woo')).toBe('');
  });

  it('preselecciona plataformas que tienen un único camino principal', () => {
    expect(suggestedSchemaInstallMethod('shopify')).toBe('shopify');
    expect(suggestedSchemaInstallMethod('tiendanube')).toBe('tiendanube');
    expect(suggestedSchemaInstallMethod('other')).toBe('other');
  });

  it('advierte sobre plantillas globales en constructores y tiendas', () => {
    expect(getSchemaPasteGuide('wp_builder').warning).toMatch(/plantilla global/i);
    expect(getSchemaPasteGuide('shopify').warning).toMatch(/theme\.liquid/i);
    expect(getSchemaPasteGuide('tiendanube').warning).toMatch(/toda la tienda/i);
  });

  it('incluye nota Gutenberg para homes con shortcodes', () => {
    expect(getSchemaPasteGuide('wp_blocks').note).toMatch(/ux_banner/i);
    expect(getSchemaPasteGuide('wp_classic').note).toMatch(/bloques/i);
  });

  it('devuelve null para una opción desconocida', () => {
    expect(getSchemaPasteGuide('desconocida')).toBeNull();
  });
});

describe('detectSchemaInstallHints', () => {
  it('detecta Gutenberg por clases wp-block', () => {
    const html = `<div class="wp-block-group is-root-container"><p class="wp-block-paragraph">Hola</p></div>`;
    const hint = detectSchemaInstallHints(html);
    expect(hint.suggestedMethod).toBe('wp_blocks');
    expect(hint.confidence).toBe('media');
    expect(hint.reasons.length).toBeGreaterThan(0);
  });

  it('detecta Flatsome / shortcodes ux_banner como maquetador', () => {
    const html = `<div class="flatsome">[ux_banner height="500"]contenido[/ux_banner]</div>`;
    const hint = detectSchemaInstallHints(html);
    expect(hint.suggestedMethod).toBe('wp_builder');
    expect(hint.reasons.some((r) => /flatsome|ux_banner/i.test(r))).toBe(true);
  });

  it('detecta Elementor', () => {
    const html = `<div class="elementor elementor-123" data-elementor-type="wp-page"><div class="elementor-widget">x</div></div>`;
    const hint = detectSchemaInstallHints(html);
    expect(hint.suggestedMethod).toBe('wp_builder');
  });

  it('prioriza maquetador sobre bloques si ambos aparecen', () => {
    const html = `<div class="elementor wp-block-group" data-elementor-type="wp-page"></div>`;
    expect(detectSchemaInstallHints(html).suggestedMethod).toBe('wp_builder');
  });

  it('detecta Shopify', () => {
    const html = `<html><head><meta name="generator" content="Shopify"></head><script src="https://cdn.shopify.com/s/files/x.js"></script></html>`;
    const hint = detectSchemaInstallHints(html);
    expect(hint.suggestedMethod).toBe('shopify');
    expect(hint.confidence).toBe('alta');
  });

  it('no inventa editor clásico sin señales', () => {
    const hint = detectSchemaInstallHints('<html><body><h1>Hola</h1></body></html>');
    expect(hint.suggestedMethod).toBeNull();
    expect(hint.confidence).toBeNull();
  });
});

describe('resolveSchemaInstallMethod', () => {
  it('no auto-aplica Clásico si la página sugiere bloques', () => {
    const resolved = resolveSchemaInstallMethod({
      platformId: 'wp_woo',
      storedMethod: 'wp_classic',
      editorHint: { suggestedMethod: 'wp_blocks', confidence: 'media', reasons: ['bloques'] },
    });
    expect(resolved.conflict).toBe(true);
    expect(resolved.method).toBe('');
    expect(resolved.suggestedMethod).toBe('wp_blocks');
    expect(resolved.conflictMessage).toMatch(/clásico|Clásico/i);
  });

  it('usa stored cuando no hay conflicto', () => {
    const resolved = resolveSchemaInstallMethod({
      platformId: 'wp_woo',
      storedMethod: 'wp_blocks',
      editorHint: { suggestedMethod: 'wp_blocks', confidence: 'media', reasons: [] },
    });
    expect(resolved.conflict).toBe(false);
    expect(resolved.method).toBe('wp_blocks');
  });

  it('usa el hint cuando no hay stored', () => {
    const resolved = resolveSchemaInstallMethod({
      platformId: 'wp_woo',
      storedMethod: '',
      editorHint: { suggestedMethod: 'wp_builder', confidence: 'media', reasons: [] },
    });
    expect(resolved.method).toBe('wp_builder');
    expect(resolved.conflict).toBe(false);
  });

  it('usa fallback de plataforma Shopify sin hint', () => {
    const resolved = resolveSchemaInstallMethod({
      platformId: 'shopify',
      storedMethod: '',
      editorHint: null,
    });
    expect(resolved.method).toBe('shopify');
  });
});
