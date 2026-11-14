import { describe, expect, it } from 'vitest';

import {
  GEO_FOURSQUARE_PROXY_PREFIX,
  GEO_MAPTILER_API_PROXY,
  GEO_MAPTILER_CDN_PROXY,
  absolutizeSameOriginGeoProxyPath,
  isSameOriginGeoProxyPath,
} from '../../../src/config/geo-proxy';

describe('geo-proxy paths', () => {
  it('exposes unified /__geo prefixes', () => {
    expect(GEO_FOURSQUARE_PROXY_PREFIX).toBe('/__geo/foursquare');
    expect(GEO_MAPTILER_API_PROXY).toBe('/__geo/maptiler-api/');
    expect(GEO_MAPTILER_CDN_PROXY).toBe('/__geo/maptiler-cdn/');
  });

  it('detects same-origin geo proxy paths', () => {
    expect(isSameOriginGeoProxyPath('/__geo/foursquare/places/search')).toBe(true);
    expect(isSameOriginGeoProxyPath('/__maptiler-api/maps/basic/style.json')).toBe(true);
    expect(isSameOriginGeoProxyPath('https://api.maptiler.com/tiles.json')).toBe(false);
  });

  it('absolutizes relative proxy paths when window is present', () => {
    const path = '/__geo/maptiler-api/tiles.json';
  const result = absolutizeSameOriginGeoProxyPath(path);
  if (typeof window !== 'undefined' && window.location?.origin) {
      expect(result).toBe(`${window.location.origin}${path}`);
    } else {
      expect(result).toBe(path);
    }
  });
});
