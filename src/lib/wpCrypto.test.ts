import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateWpToken,
  encryptWpToken,
  decryptWpToken,
  hintWpToken,
  normalizeSiteUrl,
} from './wpCrypto';

describe('wpCrypto', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-for-wp-connector-unit-tests';
  });

  it('genera tokens con prefijo sj_', () => {
    const t = generateWpToken();
    expect(t.startsWith('sj_')).toBe(true);
    expect(t.length).toBeGreaterThan(20);
  });

  it('cifra y descifra round-trip', () => {
    const t = generateWpToken();
    const enc = encryptWpToken(t);
    expect(enc.startsWith('v1.')).toBe(true);
    expect(decryptWpToken(enc)).toBe(t);
  });

  it('hint oculta el medio del token', () => {
    expect(hintWpToken('sj_abcdefghijklmnop')).toMatch(/^sj_abc…/);
  });

  it('normaliza site url al origen', () => {
    expect(normalizeSiteUrl('https://tienda.com/producto/x')).toBe('https://tienda.com');
    expect(normalizeSiteUrl('tienda.com')).toBe('https://tienda.com');
    expect(normalizeSiteUrl('')).toBeNull();
  });
});
