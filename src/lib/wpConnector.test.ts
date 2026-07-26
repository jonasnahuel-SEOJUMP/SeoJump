import { describe, it, expect } from 'vitest';
import { mapMissionTypeToWpField } from './wpConnector';

describe('mapMissionTypeToWpField', () => {
  it('mapea H1 a title y META a meta', () => {
    expect(mapMissionTypeToWpField('H1')).toBe('title');
    expect(mapMissionTypeToWpField('META')).toBe('meta');
  });

  it('rechaza tipos no soportados', () => {
    expect(mapMissionTypeToWpField('ALT')).toBeNull();
    expect(mapMissionTypeToWpField('AEO')).toBeNull();
    expect(mapMissionTypeToWpField('')).toBeNull();
  });
});
