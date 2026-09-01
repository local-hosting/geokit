/**
 * Web tile prefetch via Cache API + coverage reporting (Tier C).
 */
import type { MapOfflineCoverage, MapOfflinePolicy, MapOfflinePrefetchRequest } from '@geokit/core/contract/offline';
export declare const TILE_CACHE_NAME = "geokit-tiles-v1";
export interface OfflineRegionRecord {
    mapId: string;
    urlTemplate: string;
    bounds: MapOfflinePrefetchRequest['bounds'];
    zoomRange: MapOfflinePrefetchRequest['zoomRange'];
    tilesRequired: number;
    bytesUsed: number;
    updatedAt: number;
}
export interface MapOfflinePrefetchOptions {
    /** Tile URL template with `{z}`, `{x}`, `{y}` placeholders. */
    urlTemplate: string;
    policy?: MapOfflinePolicy;
    signal?: AbortSignal;
    concurrency?: number;
}
export interface MapOfflinePrefetchProgress {
    tilesCached: number;
    tilesRequired: number;
    fractionComplete: number;
}
export declare class MapOfflineTileCache {
    private static instance;
    static getInstance(): MapOfflineTileCache;
    static resetForTesting(): void;
    getCoverage(request: MapOfflinePrefetchRequest, urlTemplate: string, policy?: MapOfflinePolicy): Promise<MapOfflineCoverage>;
    prefetch(request: MapOfflinePrefetchRequest, options: MapOfflinePrefetchOptions, onProgress?: (progress: MapOfflinePrefetchProgress) => void): Promise<MapOfflineCoverage>;
    removeRegion(mapId: string): Promise<void>;
    clearAll(): Promise<void>;
}
//# sourceMappingURL=map-offline-tile-cache.d.ts.map