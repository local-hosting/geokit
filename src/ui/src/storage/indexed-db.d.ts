/**
 * Minimal IndexedDB helpers for geokit offline storage (browser only).
 */
export declare const STATE_STORE = "mapLocalState";
export declare const SNAPSHOT_STORE = "mapSnapshots";
export declare const OFFLINE_REGIONS_STORE = "offlineRegions";
export declare function openGeoKitOfflineDB(): Promise<IDBDatabase>;
export declare function idbGet<T>(storeName: string, key: IDBValidKey): Promise<T | undefined>;
export declare function idbGetAll<T>(storeName: string): Promise<T[]>;
export declare function idbPut<T>(storeName: string, value: T): Promise<void>;
export declare function idbDelete(storeName: string, key: IDBValidKey): Promise<void>;
/** Test-only reset */
export declare function resetGeoKitOfflineDBForTesting(): Promise<void>;
//# sourceMappingURL=indexed-db.d.ts.map