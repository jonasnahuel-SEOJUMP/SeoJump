import { describe, expect, it } from 'vitest';
import {
  HOME_BRAND_PROTECTION_MARKER,
  buildTitleH1PromptPageRules,
  homeBrandProtectionInstructions,
} from './homeBrandPrompt';

describe('homeBrandProtectionInstructions', () => {
  it('incluye la regla de no tocar marca en H1 y title cuando pageType es home', () => {
    const block = homeBrandProtectionInstructions('home');
    expect(block).toContain(HOME_BRAND_PROTECTION_MARKER);
    expect(block.toLowerCase()).toMatch(/marca/);
    expect(block).toMatch(/H1/);
    expect(block).toMatch(/<title>/);
    expect(block.toLowerCase()).toMatch(/prohibido reemplazar/);
  });

  it('no inyecta la regla en producto, categoría o post', () => {
    expect(homeBrandProtectionInstructions('product')).toBe('');
    expect(homeBrandProtectionInstructions('category')).toBe('');
    expect(homeBrandProtectionInstructions('post')).toBe('');
    expect(homeBrandProtectionInstructions('')).toBe('');
    expect(homeBrandProtectionInstructions(null)).toBe('');
  });
});

describe('buildTitleH1PromptPageRules', () => {
  it('el prompt armado para home contiene la instrucción de marca (H1 y title)', () => {
    const prompt = buildTitleH1PromptPageRules({ pageType: 'home' });
    expect(prompt).toContain(HOME_BRAND_PROTECTION_MARKER);
    expect(prompt).toMatch(/H1/);
    expect(prompt).toMatch(/<title>/);
  });

  it('también aplica si isHubPage aunque pageType venga vacío', () => {
    const prompt = buildTitleH1PromptPageRules({ isHubPage: true, pageType: '' });
    expect(prompt).toContain(HOME_BRAND_PROTECTION_MARKER);
  });

  it('no agrega la regla en páginas internas', () => {
    expect(buildTitleH1PromptPageRules({ pageType: 'product' })).toBe('');
    expect(buildTitleH1PromptPageRules({ pageType: 'category', isHubPage: false })).toBe('');
  });
});
