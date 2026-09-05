import { describe, expect, it } from 'vitest';
import { isRootHomeUrl } from './urlHome';

describe('isRootHomeUrl', () => {
  it('detecta dominio raíz con y sin barra final', () => {
    expect(isRootHomeUrl('https://ejemplo.com')).toBe(true);
    expect(isRootHomeUrl('https://ejemplo.com/')).toBe(true);
    expect(isRootHomeUrl('ejemplo.com')).toBe(true);
    expect(isRootHomeUrl('ejemplo.com/')).toBe(true);
  });

  it('no marca paths internos como home', () => {
    expect(isRootHomeUrl('https://ejemplo.com/blog')).toBe(false);
    expect(isRootHomeUrl('https://ejemplo.com/blog/post')).toBe(false);
    expect(isRootHomeUrl('https://ejemplo.com/producto/x')).toBe(false);
  });

  it('tolera query y hash en la home', () => {
    expect(isRootHomeUrl('https://ejemplo.com/?utm=1')).toBe(true);
    expect(isRootHomeUrl('https://ejemplo.com/#contacto')).toBe(true);
  });
});
