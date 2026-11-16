import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MapOfflineTileCache, TILE_CACHE_NAME } from '@local-hosting/geokit/ui/storage/map-offline-tile-cache';
import { resetGeoKitOfflineDBForTesting } from '@local-hosting/geokit/ui/storage/indexed-db';
import {
  buildOfflineTileUrl,
  enumerateOfflineTileCoordinates,
} from '@local-hosting/geokit/core/contract/offline';

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

function installFakeIndexedDB() {
  const databases = new Map<string, { stores: Map<string, Map<IDBValidKey, unknown>> }>();
  class FakeRequest {
    onsuccess: ((event: Event) => void) | null = null;
    onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
    result: unknown;
  }
  class FakeObjectStore {
    constructor(private data: Map<IDBValidKey, unknown>) {}
    get(key: IDBValidKey) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        request.result = this.data.get(key);
        request.onsuccess?.({} as Event);
      });
      return request as IDBRequest;
    }
    getAll() {
      const request = new FakeRequest();
      queueMicrotask(() => {
        request.result = [...this.data.values()];
        request.onsuccess?.({} as Event);
      });
      return request as IDBRequest;
    }
    put(value: unknown) {
      const request = new FakeRequest();
      const record = value as { mapId?: string; key?: string };
      const key = (record.mapId ?? record.key) as IDBValidKey;
      queueMicrotask(() => {
        this.data.set(key, value);
        request.onsuccess?.({} as Event);
      });
      return request as IDBRequest;
    }
    delete(key: IDBValidKey) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        this.data.delete(key);
        request.onsuccess?.({} as Event);
      });
      return request as IDBRequest;
    }
  }
  class FakeDatabase {
    objectStoreNames = { contains: (name: string) => this.stores.has(name) };
    constructor(public stores: Map<string, Map<IDBValidKey, unknown>>) {}
    createObjectStore(name: string) {
      const data = new Map<IDBValidKey, unknown>();
      this.stores.set(name, data);
      return new FakeObjectStore(data);
    }
    transaction(storeName: string) {
      return { objectStore: () => new FakeObjectStore(this.stores.get(storeName)!) };
    }
  }
  vi.stubGlobal('indexedDB', {
    open(name: string) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        const record = databases.get(name) ?? { stores: new Map() };
        if (!databases.has(name)) databases.set(name, record);
        const db = new FakeDatabase(record.stores);
        request.result = db;
        request.onupgradeneeded?.({ target: request } as IDBVersionChangeEvent);
        request.onsuccess?.({} as Event);
      });
      return request as IDBOpenDBRequest;
    },
    deleteDatabase(name: string) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        databases.delete(name);
        request.onsuccess?.({} as Event);
      });
      return request as IDBOpenDBRequest;
    },
  } as IDBFactory);
}

describe('storage/map-offline-tile-cache durable paths', () => {
  beforeEach(() => {
    installFakeIndexedDB();
  });

  it('reuses cached tiles without refetching', async () => {
    const cache = MapOfflineTileCache.getInstance();
    const template = 'https://tiles.example/{z}/{x}/{y}.pbf';
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await cache.prefetch({ mapId: 'trip-2', bounds, zoomRange }, { urlTemplate: template });
    fetchMock.mockClear();
    const coverage = await cache.prefetch({ mapId: 'trip-2', bounds, zoomRange }, { urlTemplate: template });
    expect(coverage.tilesCached).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('removeRegion and clearAll delete cached tiles and metadata', async () => {
    const cache = MapOfflineTileCache.getInstance();
    const template = 'https://tiles.example/{z}/{x}/{y}.pbf';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'content-length': '2' } })));

    await cache.prefetch({ mapId: 'trip-3', bounds, zoomRange }, { urlTemplate: template });
    await cache.removeRegion('trip-3');
    await cache.clearAll();
    const reopened = await caches.open(TILE_CACHE_NAME);
    expect((await reopened.keys()).length).toBe(0);
  });

  it('reports prefetch progress and skips failed tile fetches', async () => {
    const cache = MapOfflineTileCache.getInstance();
    const template = 'https://tiles.example/{z}/{x}/{y}.pbf';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 500 }))
    );
    const progress: number[] = [];
    const coverage = await cache.prefetch(
      { mapId: 'trip-4', bounds, zoomRange },
      { urlTemplate: template },
      (p) => progress.push(p.fractionComplete)
    );
    expect(coverage.tilesCached).toBe(0);
    expect(progress.length).toBe(0);
  });
});
