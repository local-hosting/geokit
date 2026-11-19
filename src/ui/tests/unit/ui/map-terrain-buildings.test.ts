import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHillshadeRasterSource,
  buildTerrainDemSource,
  cleanupTerrain,
  createBuildingsZoomHandler,
  createTerrainZoomHandler,
  ensureGeoJsonOverlaysAbove3dBuildings,
  findBuildingsInsertBeforeLayer,
  isBasemapTerrainChromeLayer,
  setBasemapTerrainChromeVisible,
} from '../../../src/components/elements/map/map-terrain-buildings';
import { configure } from '../../../src/providers/registry';

function createMapStub(layers: Array<Record<string, unknown>> = []) {
  const layout = new Map<string, string>();
  return {
    addSource: vi.fn(),
    getSource: vi.fn(() => null),
    setTerrain: vi.fn(),
    getTerrain: vi.fn(() => null),
    getZoom: vi.fn(() => 8),
    on: vi.fn(),
    off: vi.fn(),
    getStyle: vi.fn(() => ({ layers, sources: {} })),
    getLayoutProperty: vi.fn((id: string, key: string) =>
      key === 'visibility' ? layout.get(id) : undefined
    ),
    setLayoutProperty: vi.fn((id: string, key: string, value: string) => {
      if (key === 'visibility') layout.set(id, value);
    }),
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

  it('identifies Corio/Mapbox contour + style hillshade layers as terrain chrome', () => {
    expect(isBasemapTerrainChromeLayer({ id: 'contour-line', 'source-layer': 'contour' })).toBe(
      true
    );
    expect(isBasemapTerrainChromeLayer({ id: 'contour-label', 'source-layer': 'contour' })).toBe(
      true
    );
    expect(isBasemapTerrainChromeLayer({ id: 'hillshade', 'source-layer': 'hillshade' })).toBe(
      true
    );
    expect(isBasemapTerrainChromeLayer({ id: 'gk-hillshade-layer' })).toBe(false);
    expect(isBasemapTerrainChromeLayer({ id: 'road-primary', 'source-layer': 'road' })).toBe(false);
  });

  it('Mapbox uses style mapbox-dem — does not add MapLibre demotiles', () => {
    const layers = [{ id: 'contour-line', type: 'line', 'source-layer': 'contour' }];
    const map = createMapStub(layers);
    map.getStyle = vi.fn(() => ({
      layers,
      sources: { 'mapbox-dem': { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1' } },
    }));
    const attrs = new Map<string, string>([
      ['terrain-enabled', 'true'],
      ['provider', 'mapbox'],
    ]);

    const handler = createTerrainZoomHandler({
      getAttribute: (name) => attrs.get(name) ?? null,
      map: map as never,
    });
    expect(handler).not.toBeNull();
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.setTerrain).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'mapbox-dem' })
    );
  });

  it('hides basemap contour lines when terrain is toggled off', () => {
    const layers = [
      { id: 'contour-line', type: 'line', 'source-layer': 'contour' },
      { id: 'contour-label', type: 'symbol', 'source-layer': 'contour' },
      { id: 'hillshade', type: 'fill', 'source-layer': 'hillshade' },
      { id: 'road', type: 'line', 'source-layer': 'road' },
    ];
    const map = createMapStub(layers);
    map.getStyle = vi.fn(() => ({
      layers,
      sources: { 'mapbox-dem': { type: 'raster-dem' } },
    }));
    map.getTerrain = vi.fn(() => ({ source: 'mapbox-dem' }));
    const attrs = new Map<string, string>([
      ['terrain-enabled', 'true'],
      ['provider', 'mapbox'],
    ]);

    const handler = createTerrainZoomHandler({
      getAttribute: (name) => attrs.get(name) ?? null,
      map: map as never,
    });
    expect(handler).not.toBeNull();
    expect(map.setLayoutProperty).toHaveBeenCalledWith('contour-line', 'visibility', 'visible');

    map.setLayoutProperty.mockClear();
    map.setTerrain.mockClear();
    map.getTerrain = vi.fn(() => ({ source: 'mapbox-dem' }));
    attrs.set('terrain-enabled', 'false');
    handler!();

    expect(map.setTerrain).toHaveBeenCalledWith(null);
    expect(map.setLayoutProperty).toHaveBeenCalledWith('contour-line', 'visibility', 'none');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('contour-label', 'visibility', 'none');
    expect(map.setLayoutProperty).toHaveBeenCalledWith('hillshade', 'visibility', 'none');
    expect(map.setLayoutProperty).not.toHaveBeenCalledWith('road', 'visibility', 'none');
  });

  it('cleanupTerrain hides chrome and skips setTerrain when already cleared', () => {
    const layers = [{ id: 'contour-line', type: 'line', 'source-layer': 'contour' }];
    const map = createMapStub(layers);
    map.getTerrain = vi.fn(() => null);
    cleanupTerrain(map as never, null);
    expect(map.setTerrain).not.toHaveBeenCalled();
    expect(map.setLayoutProperty).toHaveBeenCalledWith('contour-line', 'visibility', 'none');
  });

  it('setBasemapTerrainChromeVisible is a no-op without style APIs', () => {
    expect(() => setBasemapTerrainChromeVisible(null, false)).not.toThrow();
    expect(() => setBasemapTerrainChromeVisible({} as never, true)).not.toThrow();
  });

  it('findBuildingsInsertBeforeLayer prefers GeoJSON venue layers', () => {
    const layers = [
      { id: 'road', type: 'line' },
      { id: 'basemap-circle', type: 'circle', source: 'composite' },
      { id: 'canvas-places-glow', type: 'circle', source: 'canvas-places' },
    ];
    const sources = {
      composite: { type: 'vector' },
      'canvas-places': { type: 'geojson' },
    };
    expect(findBuildingsInsertBeforeLayer(layers, sources)).toBe('canvas-places-glow');
  });

  it('createBuildingsZoomHandler raises GeoJSON overlays after extrusion add', () => {
    const layers = [
      { id: 'canvas-places-point', type: 'circle', source: 'canvas-places' },
    ];
    const moveLayer = vi.fn();
    const addLayer = vi.fn();
    const map = {
      getZoom: vi.fn(() => 15),
      getLayer: vi.fn((id: string) =>
        id === 'gk-3d-buildings' ? null : layers.some((l) => l.id === id) ? { id } : null,
      ),
      getStyle: vi.fn(() => ({
        layers,
        sources: {
          composite: { type: 'vector' },
          'canvas-places': { type: 'geojson' },
        },
      })),
      addLayer,
      moveLayer,
      on: vi.fn(),
      off: vi.fn(),
      setLayoutProperty: vi.fn(),
    };
    const attrs = new Map<string, string>([
      ['buildings-enabled', 'true'],
      ['buildings-min-zoom', '14'],
    ]);
    createBuildingsZoomHandler({
      getAttribute: (name) => attrs.get(name) ?? null,
      map: map as never,
    });
    expect(addLayer).toHaveBeenCalled();
    expect(moveLayer).toHaveBeenCalledWith('canvas-places-point');
  });

  it('ensureGeoJsonOverlaysAbove3dBuildings moves geojson line and circle layers', () => {
    const moveLayer = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) => (id === 'gk-3d-buildings' || id === 'mesh' ? { id } : null)),
      getStyle: vi.fn(() => ({
        sources: { mesh: { type: 'geojson' } },
        layers: [{ id: 'mesh', type: 'line', source: 'mesh' }],
      })),
      moveLayer,
    };
    ensureGeoJsonOverlaysAbove3dBuildings(map as never);
    expect(moveLayer).toHaveBeenCalledWith('mesh');
  });
});
