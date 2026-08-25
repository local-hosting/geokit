import { describe, expect, it } from 'vitest';
import {
  buildMaptilerStyleUrl,
  createTileCdnTransformFromEnv,
  resolveMapStyleUrlFromEnv,
  resolveMaptilerStaticMapsBase,
  resolveTileApiUrlFromEnv,
} from '../../../src/config/tile-cdn.js';

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
