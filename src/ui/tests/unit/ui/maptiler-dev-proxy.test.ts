import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createMapTilerDevTransformRequest,
  inlineMapTilerTileJsonSources,
  rewriteMapTilerStyleResourceUrls,
  rewriteMapTilerUrl,
} from '../../../src/dev-proxy/maptiler-dev-proxy';

describe('rewriteMapTilerUrl', () => {
  it('rewrites api and cdn URLs when enabled', () => {
    const options = { enabled: true };
    expect(
      rewriteMapTilerUrl('https://api.maptiler.com/maps/basic/style.json?key=x', options)
    ).toBe('/__geo/maptiler-api/maps/basic/style.json?key=x');
    expect(rewriteMapTilerUrl('https://cdn.maptiler.com/foo', options)).toBe('/__geo/maptiler-cdn/foo');
  });

  it('passes through when disabled', () => {
    const url = 'https://api.maptiler.com/tiles.json';
    expect(rewriteMapTilerUrl(url, { enabled: false })).toBe(url);
  });
});

describe('rewriteMapTilerStyleResourceUrls', () => {
  const transformRequest = createMapTilerDevTransformRequest({ enabled: true });

  it('rewrites embedded source, sprite, and glyph URLs', () => {
    const style: Record<string, unknown> = {
      version: 8,
      sources: {
        land: {
          url: 'https://api.maptiler.com/tiles/land/tiles.json?key=x',
          type: 'vector',
        },
        dem: {
          tiles: ['https://api.maptiler.com/tiles/dem/{z}/{x}/{y}.png?key=x'],
          type: 'raster',
        },
      },
      sprite: 'https://api.maptiler.com/maps/backdrop-dark/sprite?key=x',
      glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=x',
    };

    rewriteMapTilerStyleResourceUrls(style, transformRequest);

    expect((style.sources as Record<string, { url: string }>).land.url).toBe(
      '/__geo/maptiler-api/tiles/land/tiles.json?key=x'
    );
    expect((style.sources as Record<string, { tiles: string[] }>).dem.tiles[0]).toBe(
      '/__geo/maptiler-api/tiles/dem/{z}/{x}/{y}.png?key=x'
    );
    expect(style.sprite).toBe('/__geo/maptiler-api/maps/backdrop-dark/sprite?key=x');
    expect(style.glyphs).toBe('/__geo/maptiler-api/fonts/{fontstack}/{range}.pbf?key=x');
  });
});

describe('inlineMapTilerTileJsonSources', () => {
  const transformRequest = createMapTilerDevTransformRequest({ enabled: true });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('inlines proxied tile templates and drops TileJSON url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string) => ({
        ok: true,
        json: async () => ({
          tiles: ['https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=x'],
          minzoom: 0,
          maxzoom: 15,
          bounds: [-180, -85, 180, 85],
        }),
      }))
    );

    const style: Record<string, unknown> = {
      version: 8,
      sources: {
        maptiler_planet: {
          url: '/__maptiler-api/tiles/v3/tiles.json?key=x',
          type: 'vector',
        },
      },
    };

    await inlineMapTilerTileJsonSources(style, transformRequest);

    const planet = (style.sources as Record<string, Record<string, unknown>>).maptiler_planet;
    expect(planet.url).toBeUndefined();
    const tile = (planet.tiles as string[])[0];
    expect(tile).toContain('/__geo/maptiler-api/tiles/v3/{z}/{x}/{y}.pbf?key=x');
    // Without maxzoom, MapLibre requests z16+ tiles that MapTiler rejects ("Out of bounds").
    expect(planet.minzoom).toBe(0);
    expect(planet.maxzoom).toBe(15);
    expect(planet.bounds).toEqual([-180, -85, 180, 85]);
  });

  it('leaves source unchanged when TileJSON fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
      }))
    );

    const style: Record<string, unknown> = {
      version: 8,
      sources: {
        maptiler_planet: {
          url: '/__maptiler-api/tiles/v3/tiles.json?key=x',
          type: 'vector',
        },
      },
    };

    await inlineMapTilerTileJsonSources(style, transformRequest);

    const planet = (style.sources as Record<string, Record<string, unknown>>).maptiler_planet;
    expect(planet.url).toBe('/__maptiler-api/tiles/v3/tiles.json?key=x');
    expect(planet.tiles).toBeUndefined();
  });
});
