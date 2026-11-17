import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHillshadeRasterSource,
  buildTerrainDemSource,
  createTerrainZoomHandler,
} from '../../../src/components/elements/map/map-terrain-buildings';
import { configure } from '../../../src/providers/registry';

function createMapStub() {
  return {
    addSource: vi.fn(),
    getSource: vi.fn(() => null),
    setTerrain: vi.fn(),
    getZoom: vi.fn(() => 8),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('map-terrain-buildings', () => {
  afterEach(() => {
    configure({ maptiler: { transformRequest: undefined } });
  });

  it('createTerrainZoomHandler enables terrain without terrain-min-zoom', () => {
    configure({
      maptiler: {
        transformRequest: (url: string) => ({ url: `/proxy/${url}` }),
      },
    });
    const map = createMapStub();
    const attrs = new Map<string, string>([
      ['terrain-enabled', 'true'],
      ['provider', 'maptiler'],
      ['api-key', 'test-key'],
    ]);

    const handler = createTerrainZoomHandler({
      getAttribute: (name) => attrs.get(name) ?? null,
      map: map as never,
    });

    expect(handler).not.toBeNull();
    expect(map.addSource).toHaveBeenCalled();
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'gk-terrain-dem' })
    );
  });

  it('createTerrainZoomHandler returns null when terrain-enabled is off', () => {
    const map = createMapStub();
    const handler = createTerrainZoomHandler({
      getAttribute: (name) => (name === 'terrain-enabled' ? 'false' : null),
      map: map as never,
    });
    expect(handler).toBeNull();
    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('terrain zoom handler re-adds DEM source after style wipe before setTerrain', () => {
    const map = createMapStub();
    let hasSource = false;
    map.getSource = vi.fn(() => (hasSource ? { type: 'raster-dem' } : null));
    map.addSource = vi.fn(() => {
      hasSource = true;
    });

    const attrs = new Map<string, string>([
      ['terrain-enabled', 'true'],
      ['provider', 'maptiler'],
      ['api-key', 'test-key'],
    ]);

    const handler = createTerrainZoomHandler({
      getAttribute: (name) => attrs.get(name) ?? null,
      map: map as never,
    });
    expect(handler).not.toBeNull();
    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.setTerrain).toHaveBeenCalled();

    // Style swap / full rebuild drops the DEM source; zoom/move still fires the handler.
    hasSource = false;
    map.addSource.mockClear();
    map.setTerrain.mockClear();

    handler!();

    expect(map.addSource).toHaveBeenCalledWith(
      'gk-terrain-dem',
      expect.objectContaining({ type: 'raster-dem' })
    );
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'gk-terrain-dem' })
    );
  });

  it('buildTerrainDemSource uses proxied tile templates when transformRequest is set', () => {
    configure({
      maptiler: {
        transformRequest: (url: string) => ({ url: `/proxy/${url}` }),
      },
    });

    const spec = buildTerrainDemSource({
      provider: 'maptiler',
      apiKey: 'test-key',
    });

    expect(spec.tiles).toEqual([
      '/proxy/https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=test-key',
    ]);
    expect(spec.maxzoom).toBe(14);
    expect(spec.url).toBeUndefined();
  });

  it('buildTerrainDemSource falls back to tiles.json without transformRequest', () => {
    const spec = buildTerrainDemSource({
      provider: 'maptiler',
      apiKey: 'test-key',
    });

    expect(spec.url).toBe('https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=test-key');
    expect(spec.tiles).toBeUndefined();
  });

  it('buildHillshadeRasterSource uses proxied tile templates when transformRequest is set', () => {
    configure({
      maptiler: {
        transformRequest: (url: string) => ({ url: `/proxy/${url}` }),
      },
    });

    const spec = buildHillshadeRasterSource(
      'test-key',
      'https://api.maptiler.com/tiles/hand-drawn-hillshade/tiles.json?key=test-key'
    );

    expect(spec.tiles).toEqual([
      '/proxy/https://api.maptiler.com/tiles/hand-drawn-hillshade/{z}/{x}/{y}.webp?key=test-key',
    ]);
    expect(spec.maxzoom).toBe(9);
    expect(spec.minzoom).toBe(0);
    expect(spec.url).toBeUndefined();
  });

  it('buildHillshadeRasterSource without proxy keeps tiles.json (maxzoom from MapTiler)', () => {
    const fallback =
      'https://api.maptiler.com/tiles/hand-drawn-hillshade/tiles.json?key=test-key';
    const spec = buildHillshadeRasterSource('test-key', fallback);
    expect(spec).toEqual({ type: 'raster', url: fallback, tileSize: 256 });
  });
});
