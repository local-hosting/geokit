import { describe, expect, it } from 'vitest';
import {
  isGeoCdnConfigured,
  resolveGlobeCdnBaseUrl,
  resolveGlobeCdnBaseUrlFromEnvSnapshot,
} from '../../src/cdn/config.js';
import { isGeoCdnConfiguredFromEnv } from '../../src/config/env/geo-cdn.js';
import {
  buildMaptilerStyleUrl,
  createTileCdnTransformFromEnv,
  resolveMapStyleUrlFromEnv,
  resolveMaptilerStaticMapsBase,
  resolveTileApiUrlFromEnv,
} from '../../src/config/tile-cdn.js';

describe('resolveGlobeCdnBaseUrl', () => {
  it('returns empty string when unset', () => {
    expect(resolveGlobeCdnBaseUrlFromEnvSnapshot({})).toBe('');
    expect(isGeoCdnConfiguredFromEnv({})).toBe(false);
  });

  it('prefers GEOKIT_GEO_CDN_URL', () => {
    expect(resolveGlobeCdnBaseUrl('https://geo.example.com/')).toBe('https://geo.example.com');
    expect(isGeoCdnConfigured('https://geo.example.com')).toBe(true);
  });
});

describe('tile CDN env', () => {
  it('reads GEOKIT_MAP_STYLE_URL', () => {
    expect(
      resolveMapStyleUrlFromEnv({
        GEOKIT_MAP_STYLE_URL: 'https://tiles.example.com/styles/dark/style.json',
      })
    ).toBe('https://tiles.example.com/styles/dark/style.json');
  });

  it('rewrites static maps base from GEOKIT_TILE_API_URL', () => {
    expect(
      resolveMaptilerStaticMapsBase({
        GEOKIT_TILE_API_URL: 'https://tiles.example.com/',
      })
    ).toBe('https://tiles.example.com/maps');
  });

  it('builds style URL from tile API prefix', () => {
    expect(
      buildMaptilerStyleUrl('dataviz-dark', 'test-key', {
        GEOKIT_TILE_API_URL: 'https://tiles.example.com/',
      })
    ).toBe('https://tiles.example.com/maps/dataviz-dark/style.json?key=test-key');
  });

  it('prefers explicit GEOKIT_MAP_STYLE_URL over style name', () => {
    expect(
      buildMaptilerStyleUrl('dataviz-dark', 'test-key', {
        GEOKIT_MAP_STYLE_URL: 'https://tiles.example.com/custom/style.json',
      })
    ).toBe('https://tiles.example.com/custom/style.json');
  });

  it('creates transform when tile CDN prefixes are set', () => {
    const transform = createTileCdnTransformFromEnv({
      GEOKIT_TILE_API_URL: 'https://tiles.example.com/',
    });
    expect(transform).toBeTypeOf('function');
    expect(transform!('https://api.maptiler.com/maps/basic/style.json').url).toBe(
      'https://tiles.example.com/maps/basic/style.json'
    );
  });

  it('returns undefined transform when tile CDN env is unset', () => {
    expect(createTileCdnTransformFromEnv({})).toBeUndefined();
    expect(resolveTileApiUrlFromEnv({})).toBeUndefined();
  });
});
