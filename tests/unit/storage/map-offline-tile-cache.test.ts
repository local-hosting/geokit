import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapOfflineTileCache, TILE_CACHE_NAME } from '../../../src/storage/map-offline-tile-cache.js';
import { resetGeoKitOfflineDBForTesting } from '../../../src/storage/indexed-db.js';
import {
  buildOfflineTileUrl,
  enumerateOfflineTileCoordinates,
} from '../../../src/contract/offline.js';

const bounds = { south: 40.7, west: -74.02, north: 40.72, east: -74.0 };
const zoomRange = { minZoom: 10, maxZoom: 10 };

function installMemoryCacheMock() {
  const stores = new Map<string, Map<string, Response>>();
  const api = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        match: async (request: RequestInfo) => {
          const url = String(request);
          return store.get(url);
        },
        put: async (request: RequestInfo, response: Response) => {
          store.set(String(request), response);
        },
        delete: async (request: RequestInfo) => store.delete(String(request)),
        keys: async () => [...store.keys()].map((url) => ({ url } as Request)),
      };
    },
    delete: async (name: string) => stores.delete(name),
    keys: async () => [...stores.keys()],
  };
  vi.stubGlobal('caches', api);
  return stores;
}

beforeEach(() => {
  installMemoryCacheMock();
});

afterEach(async () => {
  MapOfflineTileCache.resetForTesting();
  await resetGeoKitOfflineDBForTesting();
  await caches.delete(TILE_CACHE_NAME);
  vi.restoreAllMocks();
});

describe('storage/map-offline-tile-cache', () => {
  it('builds tile urls from template', () => {
    const url = buildOfflineTileUrl('https://tiles.example/{z}/{x}/{y}.pbf', { z: 10, x: 301, y: 385 });
    expect(url).toBe('https://tiles.example/10/301/385.pbf');
  });

  it('prefetches tiles into Cache API and reports coverage', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-length': '3' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const cache = MapOfflineTileCache.getInstance();
    const template = 'https://tiles.example/{z}/{x}/{y}.pbf';
    const coverage = await cache.prefetch(
      { mapId: 'trip-1', bounds, zoomRange },
      { urlTemplate: template, policy: 'cacheFirst' }
    );

    expect(coverage.tilesRequired).toBeGreaterThan(0);
    expect(coverage.tilesCached).toBe(coverage.tilesRequired);
    expect(coverage.recommendsLiveMap).toBe(true);
    expect(fetchMock).toHaveBeenCalled();

    const reopened = await caches.open(TILE_CACHE_NAME);
    const keys = await reopened.keys();
    expect(keys.length).toBe(coverage.tilesRequired);
  });

  it('getCoverage counts cache hits without fetching', async () => {
    const template = 'https://tiles.example/{z}/{x}/{y}.pbf';
    const tileCache = MapOfflineTileCache.getInstance();
    const [firstTile] = enumerateOfflineTileCoordinates(bounds, zoomRange);
    const cache = await caches.open(TILE_CACHE_NAME);
    await cache.put(buildOfflineTileUrl(template, firstTile), new Response('ok'));

    const coverage = await tileCache.getCoverage(
      { mapId: 'trip-2', bounds, zoomRange },
      template,
      'cacheFirst'
    );
    expect(coverage.tilesRequired).toBeGreaterThan(0);
    expect(coverage.tilesCached).toBeGreaterThanOrEqual(1);
  });
});
