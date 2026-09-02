import { RequestQueue } from './request-queue';
import type { DirectionsOptions, GeocodeOptions, IsochroneOptions, PlaceSearchOptions, PlaceSearchResult, ReverseGeocodeOptions, ReverseGeocodeResult, ServiceCapability, ServiceConfig } from './types';
/** Base class for outbound geospatial HTTP integrations. */
export declare abstract class Service {
    protected config: ServiceConfig | null;
    protected apiKey: string | null;
    protected accessToken: string | null;
    abstract getName(): string;
    abstract initialize(config: ServiceConfig): Promise<void>;
    abstract getCapabilities(): ServiceCapability[];
    fetchIsochrone?(options: IsochroneOptions): Promise<unknown>;
    hasIsochroneCached?(options: IsochroneOptions): boolean;
    geocode?(options: GeocodeOptions): Promise<unknown>;
    reverseGeocode?(options: ReverseGeocodeOptions): Promise<ReverseGeocodeResult | null>;
    directions?(options: DirectionsOptions): Promise<unknown>;
    placeSearch?(options: PlaceSearchOptions): Promise<PlaceSearchResult[]>;
}
export interface CachedServiceOptions {
    cacheName: string;
    maxConcurrent?: number;
    batchDelayMs?: number;
    cacheMaxEntries?: number;
    cacheTtlMs?: number;
}
/** HTTP service with shared LRU cache and rate-limited request queue. */
export declare abstract class CachedService<TCached> extends Service {
    private readonly cachedOptions;
    protected readonly cache: import("@twinfile/geokit/core").GeoCache<unknown>;
    protected readonly queue: RequestQueue;
    constructor(cachedOptions: CachedServiceOptions);
    protected initCredentials(config: ServiceConfig, logPrefix: string): void;
    protected requireApiKey(serviceLabel: string): asserts this is {
        apiKey: string;
    };
    protected requireAccessToken(serviceLabel: string): asserts this is {
        accessToken: string;
    };
    protected cachedQueued(cacheKey: string, fn: () => Promise<TCached>): Promise<TCached>;
    protected cachedPlaceSearch(options: PlaceSearchOptions, cacheKeyPrefix: string, extraParts: string[], fn: () => Promise<PlaceSearchResult[]>): Promise<PlaceSearchResult[]>;
    getCacheStats(): import("@twinfile/geokit/core").CacheStats;
    clearCache(): void;
}
//# sourceMappingURL=service.d.ts.map