import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OFFLINE_REGIONS_STORE,
  SNAPSHOT_STORE,
  STATE_STORE,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
  resetGeoKitOfflineDBForTesting,
} from '@local-hosting/geokit/ui/storage/indexed-db';

type StoreData = Map<IDBValidKey, unknown>;

function createFakeIndexedDB(): IDBFactory {
  const databases = new Map<string, { version: number; stores: Map<string, StoreData> }>();

  class FakeRequest {
    onsuccess: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
    result: unknown;
  }

  class FakeObjectStore {
    constructor(private data: StoreData) {}
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

  class FakeTransaction {
    constructor(private store: FakeObjectStore) {}
    objectStore() {
      return this.store;
    }
  }

  class FakeDatabase {
    objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    };
    constructor(public stores: Map<string, StoreData>) {}
    createObjectStore(name: string) {
      const data = new Map<IDBValidKey, unknown>();
      this.stores.set(name, data);
      return new FakeObjectStore(data);
    }
    transaction(storeName: string) {
      return new FakeTransaction(new FakeObjectStore(this.stores.get(storeName)!));
    }
  }

  return {
    open(name: string, version = 1) {
      const request = new FakeRequest();
      queueMicrotask(() => {
        let record = databases.get(name);
        const isNew = !record;
        if (!record) {
          record = { version, stores: new Map<string, StoreData>() };
          databases.set(name, record);
        }
        const db = new FakeDatabase(record.stores);
        request.result = db;
        if (isNew) {
          request.onupgradeneeded?.({ target: request } as IDBVersionChangeEvent);
        }
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
  } as IDBFactory;
}

beforeEach(() => {
  vi.stubGlobal('indexedDB', createFakeIndexedDB());
});

afterEach(async () => {
  await resetGeoKitOfflineDBForTesting();
  vi.unstubAllGlobals();
});

describe('indexed-db helpers', () => {
  it('opens database and round-trips records in state store', async () => {
    const record = { mapId: 'map-1', cameraFrame: { center: { latitude: 1, longitude: 2 }, zoom: 3 } };
    await idbPut(STATE_STORE, record);
    const loaded = await idbGet<typeof record>(STATE_STORE, 'map-1');
    expect(loaded).toEqual(record);
    const all = await idbGetAll<typeof record>(STATE_STORE);
    expect(all).toHaveLength(1);
    await idbDelete(STATE_STORE, 'map-1');
    expect(await idbGet(STATE_STORE, 'map-1')).toBeUndefined();
  });

  it('writes to snapshot and offline region stores', async () => {
    await idbPut(SNAPSHOT_STORE, { key: 'snap-1', bytes: 3 });
    await idbPut(OFFLINE_REGIONS_STORE, { mapId: 'map-2', regions: [] });
    expect(await idbGet(SNAPSHOT_STORE, 'snap-1')).toEqual({ key: 'snap-1', bytes: 3 });
    expect(await idbGet(OFFLINE_REGIONS_STORE, 'map-2')).toEqual({ mapId: 'map-2', regions: [] });
  });
});
