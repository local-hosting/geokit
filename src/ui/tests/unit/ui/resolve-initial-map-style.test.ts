import { describe, expect, it } from 'vitest';
import { resolveInitialMapStyle } from '../../../src/components/elements/map/style/resolve-initial-map-style';

describe('resolveInitialMapStyle', () => {
  it('prefers host style-url over theme mapStyle (Corio / custom basemap)', () => {
    expect(
      resolveInitialMapStyle({
        styleUrl: 'mapbox://styles/corio/cm1gmmsh900xd01nw38jtafz7',
        themeMapStyle: 'dataviz',
        mapStyleAttr: null,
        systemMapStyle: 'dataviz-dark',
      })
    ).toBe('mapbox://styles/corio/cm1gmmsh900xd01nw38jtafz7');
  });

  it('falls back to map-style then theme then system', () => {
    expect(
      resolveInitialMapStyle({
        styleUrl: '',
        mapStyleAttr: 'streets',
        themeMapStyle: 'dataviz',
        systemMapStyle: 'dataviz-dark',
      })
    ).toBe('streets');

    expect(
      resolveInitialMapStyle({
        styleUrl: null,
        mapStyleAttr: null,
        themeMapStyle: 'dataviz',
        systemMapStyle: 'dataviz-dark',
      })
    ).toBe('dataviz');
  });
});
