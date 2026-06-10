import { describe, expect, it, vi } from 'vitest';
import {
  cellLayerResolutionForZoom,
  clearCellLayerCache,
  createCellLayerLoader,
  catalogCellIdsForViewport,
  catalogResolutionForLayer,
  filterViewportCellIdsForCatalog,
  clearCellLayerCatalogCache,
  pickLayersFromBundle,
  registerCellLayerBundleRequestHook,
} from '../../src/cdn/cell-layers';

describe('cell-layers', () => {
  it('maps zoom to resolution per layer', () => {
    expect(cellLayerResolutionForZoom(4, 'county')).toBeNull();
    expect(cellLayerResolutionForZoom(4, 'dma')).toBe(1);
    expect(cellLayerResolutionForZoom(7, 'dma')).toBe(1);
    expect(cellLayerResolutionForZoom(8, 'dma')).toBe(1);
    expect(cellLayerResolutionForZoom(8, 'county')).toBe(3);
    expect(cellLayerResolutionForZoom(4, 'county')).toBeNull();
    expect(cellLayerResolutionForZoom(10, 'dma')).toBe(1);
    expect(cellLayerResolutionForZoom(10, 'county')).toBe(3);
    expect(cellLayerResolutionForZoom(12, 'county')).toBe(4);
  });

  it('picks requested layers from bundle', () => {
    const bundle = {
      version: 1 as const,
      cellId: '84489e3',
      resolution: 4,
      layers: {
        county: {
          type: 'FeatureCollection' as const,
          features: [{ type: 'Feature' as const, properties: { fips: '48453' }, geometry: null }],
        },
        dma: {
          type: 'FeatureCollection' as const,
          features: [{ type: 'Feature' as const, properties: { slug: 'austin' }, geometry: null }],
        },
      },
    };
    const countyOnly = pickLayersFromBundle(bundle, ['county']);
    expect(countyOnly?.features).toHaveLength(1);
    expect((countyOnly!.features[0]!.properties as { fips?: string }).fips).toBe('48453');
  });

  it('selects published dma catalog cells in viewport (not tessellated r2 ids)', () => {
    const catalog = {
      version: 1 as const,
      urlPattern: '/cell/{cellId}.json' as const,
      queryLayers: ['county', 'dma'] as const,
      layerKeys: ['county', 'dma'] as const,
      resolutions: [1, 3, 4] as const,
      countyMinZoom: 7,
      count: 3,
      cellIds: ['81267', '812ab', '8126'],
    };
    const bounds = { west: -86.5, south: 37.5, east: -84, north: 39.5 };
    const selected = catalogCellIdsForViewport(catalog, bounds, {
      layer: 'dma',
      preferredResolution: 2,
      centerLat: 38.25,
      centerLng: -85.75,
      maxCells: 24,
    });
    expect(selected).toEqual(['81267', '812ab']);
    expect(selected.every((id) => catalog.cellIds.includes(id))).toBe(true);
  });

  it('loadLayerForViewport only fetches catalog dma ids', async () => {
    clearCellLayerCatalogCache();
    clearCellLayerCache('http://cdn.test');
    const hook = vi.fn();
    const unregister = registerCellLayerBundleRequestHook(hook);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/cell/layers/index.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            urlPattern: '/cell/{cellId}.json',
            queryLayers: ['dma'],
            layerKeys: ['dma'],
            resolutions: [1, 3, 4],
            countyMinZoom: 7,
            count: 2,
            cellIds: ['81267', '812ab', '8126'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/cell/81267.json') || url.endsWith('/cell/812ab.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            cellId: url.includes('81267') ? '81267' : '812ab',
            resolution: 1,
            layers: { dma: { type: 'FeatureCollection', features: [] } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const loader = createCellLayerLoader({ baseUrl: 'http://cdn.test' });
      await loader.loadLayerForViewport({
        viewport: {
          bounds: { west: -86.5, south: 37.5, east: -84, north: 39.5 },
          centerLat: 38.25,
          centerLng: -85.75,
          zoom: 6,
        },
        layer: 'dma',
        target: new Map(),
        getFeatureId: () => null,
      });

      const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
      expect(requestedUrls.some((u) => u.includes('/cell/82278.json'))).toBe(false);
      expect(requestedUrls.some((u) => u.includes('/cell/824447.json'))).toBe(false);
      expect(requestedUrls.some((u) => u.includes('/cell/81267.json'))).toBe(true);
    } finally {
      unregister();
      vi.unstubAllGlobals();
      clearCellLayerCatalogCache();
      clearCellLayerCache('http://cdn.test');
    }
  });

  it('aligns dma tessellation to coarsest catalog tier', () => {
    const catalog = {
      version: 1 as const,
      urlPattern: '/cell/{cellId}.json' as const,
      queryLayers: ['county', 'dma'] as const,
      layerKeys: ['county', 'dma'] as const,
      resolutions: [1, 3, 4] as const,
      countyMinZoom: 7,
      count: 2,
      cellIds: ['8126', '81447'],
    };
    expect(catalogResolutionForLayer(catalog, 'dma', 2)).toBe(1);
    expect(catalogResolutionForLayer(catalog, 'dma', 1)).toBe(1);
    expect(catalogResolutionForLayer(catalog, 'county', 4)).toBe(4);
    expect(catalogResolutionForLayer(catalog, 'county', 3)).toBe(3);
  });

  it('filters viewport cells to sparse catalog index', () => {
    const catalog = {
      version: 1 as const,
      urlPattern: '/cell/{cellId}.json' as const,
      queryLayers: ['county', 'dma'] as const,
      layerKeys: ['county', 'dma'] as const,
      resolutions: [1, 3, 4] as const,
      countyMinZoom: 7,
      count: 2,
      cellIds: ['8126', '81447'],
    };
    expect(filterViewportCellIdsForCatalog(catalog, ['8148b', '8126', '81447', '812a1'])).toEqual([
      '8126',
      '81447',
    ]);
    expect(filterViewportCellIdsForCatalog(null, ['8148b', '8126'])).toEqual([]);
  });

  it('emits request hooks for cache, inflight, and network fetch', async () => {
    clearCellLayerCache('http://cdn.test');
    const hook = vi.fn();
    const unregister = registerCellLayerBundleRequestHook(hook);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/cell/layers/index.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            urlPattern: '/cell/{cellId}.json',
            queryLayers: ['county', 'dma'],
            layerKeys: ['county', 'dma'],
            resolutions: [1, 3, 4],
            countyMinZoom: 7,
            count: 1,
            cellIds: ['8126'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/cell/8126.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            cellId: '8126',
            resolution: 4,
            layers: {
              dma: { type: 'FeatureCollection', features: [] },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const loader = createCellLayerLoader({ baseUrl: 'http://cdn.test' });
      const first = loader.fetchCellBundle('8126', { layer: 'dma' });
      const second = loader.fetchCellBundle('8126', { layer: 'dma' });
      await Promise.all([first, second]);
      await loader.fetchCellBundle('8126', { layer: 'dma' });

      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          cellId: '8126',
          layer: 'dma',
          url: 'http://cdn.test/cell/8126.json',
        })
      );
      expect(hook.mock.calls.some((call) => call[0].inflight === true)).toBe(true);
      expect(hook.mock.calls.some((call) => call[0].cached === true)).toBe(true);
      expect(hook.mock.calls.some((call) => !call[0].cached && !call[0].inflight)).toBe(true);
    } finally {
      unregister();
      vi.unstubAllGlobals();
      clearCellLayerCache('http://cdn.test');
    }
  });
  it('uses compact cell id in bundle url', async () => {
    clearCellLayerCache('http://cdn.test');
    const hook = vi.fn();
    const unregister = registerCellLayerBundleRequestHook(hook);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/cell/layers/index.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            urlPattern: '/cell/{cellId}.json',
            queryLayers: ['dma'],
            layerKeys: ['dma'],
            resolutions: [1, 3, 4],
            countyMinZoom: 7,
            count: 1,
            cellIds: ['8126'],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.endsWith('/cell/8126.json')) {
        return new Response(
          JSON.stringify({
            version: 1,
            cellId: '8126',
            resolution: 4,
            layers: { dma: { type: 'FeatureCollection', features: [] } },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const loader = createCellLayerLoader({ baseUrl: 'http://cdn.test' });
      await loader.fetchCellBundle('8126fffffffff', { layer: 'dma' });
      expect(hook).toHaveBeenCalledWith(
        expect.objectContaining({
          cellId: '8126',
          url: 'http://cdn.test/cell/8126.json',
        })
      );
    } finally {
      unregister();
      vi.unstubAllGlobals();
      clearCellLayerCache('http://cdn.test');
    }
  });
});
