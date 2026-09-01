/**
 * Tier D — host hook: prefetchRegion(bounds) on map context load.
 */
import type { MapOfflineCoverage, MapOfflineHostContext, MapOfflinePrefetchRequest } from '@geokit/core/contract/offline';
import { type MapOfflinePrefetchOptions } from './map-offline-tile-cache';
export interface MapOfflineContextLoaderConfig {
    urlTemplate: string;
    policy?: MapOfflinePrefetchOptions['policy'];
    /** Resolve bounds when a map surface loads (keyed by host `mapId`). */
    resolveContext?: (mapId: string) => MapOfflineHostContext | null | undefined;
}
export type MapOfflineHostPrefetchHook = (request: MapOfflinePrefetchRequest, options: MapOfflinePrefetchOptions) => Promise<MapOfflineCoverage>;
export declare class MapOfflineContextLoader {
    private static config;
    private static scheduled;
    private static hostPrefetchHook;
    static configure(config: MapOfflineContextLoaderConfig): void;
    static setHostPrefetchHook(hook: MapOfflineHostPrefetchHook | null): void;
    static resetForTesting(): void;
    /** Host-facing Tier D API — prefetch tiles for one map instance. */
    static prefetchRegion(context: MapOfflineHostContext): Promise<MapOfflineCoverage | null>;
    /** Called when a map surface becomes ready (`gk-map-ready`). */
    static onMapContextLoad(mapId: string, hints?: {
        zoom?: number;
        bounds?: MapOfflineHostContext['bounds'];
    }): Promise<MapOfflineCoverage | null>;
}
//# sourceMappingURL=map-offline-context-loader.d.ts.map