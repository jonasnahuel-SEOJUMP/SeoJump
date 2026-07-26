import { describe, it, expect } from 'vitest';
import { mapMissionTypeToWpField, pageBelongsToSite } from './wpConnector';

describe('mapMissionTypeToWpField', () => {
  it('mapea H1 → seo_title y META → meta', () => {
    expect(mapMissionTypeToWpField('H1')).toBe('seo_title');
    expect(mapMissionTypeToWpField('META')).toBe('meta');
  });

  it('rechaza tipos no soportados', () => {
    expect(mapMissionTypeToWpField('ALT')).toBeNull();
    expect(mapMissionTypeToWpField('AEO')).toBeNull();
    expect(mapMissionTypeToWpField('')).toBeNull();
  });
});

describe('pageBelongsToSite', () => {
  it('acepta mismo host con o sin www', () => {
    expect(
      pageBelongsToSite('https://www.tienda.com/producto/x', 'https://tienda.com')
    ).toBe(true);
  });

  it('rechaza otro dominio', () => {
    expect(
      pageBelongsToSite('https://otro.com/x', 'https://tienda.com')
    ).toBe(false);
  });
});
