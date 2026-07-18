import { describe, expect, it } from 'vitest';
import {
  SCHEMA_INSTALL_METHODS,
  getSchemaPasteGuide,
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

  it('no adivina qué editor usa WordPress', () => {
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

  it('devuelve null para una opción desconocida', () => {
    expect(getSchemaPasteGuide('desconocida')).toBeNull();
  });
});
