import { describe, expect, it } from 'vitest';
import {
  resolveMapboxStaticStyle,
  resolveMaptilerStaticMapsBase,
} from '../../../src/static-map/basemap';

describe('static-map basemap', () => {
  it('converts a Mapbox style URI to a static style id', () => {
    expect(
      resolveMapboxStaticStyle({
        GEOKIT_MAP_STYLE_URL: 'mapbox://styles/mapbox/dark-v11',
      })
    ).toBe('mapbox/dark-v11');
  });

  it('falls back to streets when no style env is set', () => {
    expect(resolveMapboxStaticStyle({})).toBe('mapbox/streets-v12');
  });

  it('builds the MapTiler static maps base from the tile API prefix', () => {
    expect(
      resolveMaptilerStaticMapsBase({
        GEOKIT_TILE_API_URL: 'https://tiles.example.com',
      })
    ).toBe('https://tiles.example.com/maps');
  });
});
