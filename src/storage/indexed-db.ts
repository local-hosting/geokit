/**
 * Minimal IndexedDB helpers for geokit offline storage (browser only).
 */

const DB_NAME = 'geokit-offline-v1';
const DB_VERSION = 2;
export const STATE_STORE = 'mapLocalState';
export const SNAPSHOT_STORE = 'mapSnapshots';
export const OFFLINE_REGIONS_STORE = 'offlineRegions';

let dbPromise: Promise<IDBDatabase> | null = null;

function requireIndexedDB(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }
  return indexedDB;
}

export function openGeoKitOfflineDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = requireIndexedDB().open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: 'mapId' });
        }
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(OFFLINE_REGIONS_STORE)) {
          db.createObjectStore(OFFLINE_REGIONS_STORE, { keyPath: 'mapId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('failed to open IndexedDB'));
    });
  }
  return dbPromise;
}

export function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return openGeoKitOfflineDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result as T | undefined);
        request.onerror = () => reject(request.error ?? new Error('idb get failed'));
      })
  );
}

export function idbGetAll<T>(storeName: string): Promise<T[]> {
  return openGeoKitOfflineDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve((request.result as T[]) ?? []);
        request.onerror = () => reject(request.error ?? new Error('idb getAll failed'));
      })
  );
}

export function idbPut<T>(storeName: string, value: T): Promise<void> {
  return openGeoKitOfflineDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('idb put failed'));
      })
  );
}

export function idbDelete(storeName: string, key: IDBValidKey): Promise<void> {
  return openGeoKitOfflineDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error('idb delete failed'));
      })
  );
}

/** Test-only reset */
export async function resetGeoKitOfflineDBForTesting(): Promise<void> {
  dbPromise = null;
  if (typeof indexedDB === 'undefined') return;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('idb delete database failed'));
  });
}
