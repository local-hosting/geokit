import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapOfflineContextLoader } from '../../../src/storage/map-offline-context-loader.js';
import { MapOfflineTileCache, TILE_CACHE_NAME } from '../../../src/storage/map-offline-tile-cache.js';
import { resetGeoKitOfflineDBForTesting } from '../../../src/storage/indexed-db.js';

const bounds = { south: 40.7, west: -74.02, north: 40.72, east: -74.0 };

function installMemoryCacheMock() {
  const stores = new Map<string, Map<string, Response>>();
  vi.stubGlobal('caches', {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: RequestInfo) => store.get(String(request)),
        put: async (request: RequestInfo, response: Response) => {
          store.set(String(request), response);
        },
        delete: async (request: RequestInfo) => store.delete(String(request)),
        keys: async () => [...store.keys()].map((url) => ({ url } as Request)),
      };
    },
    delete: async (name: string) => stores.delete(name),
    keys: async () => [...stores.keys()],
  });
}

beforeEach(() => installMemoryCacheMock());

afterEach(async () => {
  MapOfflineContextLoader.resetForTesting();
  MapOfflineTileCache.resetForTesting();
  await resetGeoKitOfflineDBForTesting();
  await caches.delete(TILE_CACHE_NAME);
  vi.restoreAllMocks();
});

describe('storage/map-offline-context-loader', () => {
  it('prefetchRegion uses configured tile template', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1]), { status: 200, headers: { 'content-length': '1' } }))
    );
    MapOfflineContextLoader.configure({
      urlTemplate: 'https://tiles.example/{z}/{x}/{y}.pbf',
    });

    const coverage = await MapOfflineContextLoader.prefetchRegion({
      mapId: 'trip-1',
      bounds,
      zoomRange: { minZoom: 10, maxZoom: 10 },
    });

    expect(coverage?.tilesRequired).toBeGreaterThan(0);
  });

  it('onMapContextLoad resolves bounds from host hook', async () => {
    const hook = vi.fn(async () => ({
      status: 'ready' as const,
      fractionComplete: 1,
      tilesCached: 1,
      tilesRequired: 1,
      recommendsLiveMap: true,
      recommendsSnapshotFallback: false,
    }));
    MapOfflineContextLoader.setHostPrefetchHook(hook);
    MapOfflineContextLoader.configure({
      urlTemplate: 'https://tiles.example/{z}/{x}/{y}.pbf',
      resolveContext: (mapId) => ({ mapId, bounds }),
    });

    await MapOfflineContextLoader.onMapContextLoad('trip-2');
    expect(hook).toHaveBeenCalledOnce();
  });
});
