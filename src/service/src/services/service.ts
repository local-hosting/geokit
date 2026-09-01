import { buildPlaceSearchCacheKey } from '../place-search-cache';
import { ProviderCache } from './cache';
import { RequestQueue } from './request-queue';
import type {
  DirectionsOptions,
  GeocodeOptions,
  IsochroneOptions,
  PlaceSearchOptions,
  PlaceSearchResult,
  ReverseGeocodeOptions,
  ReverseGeocodeResult,
  ServiceCapability,
  ServiceConfig,
} from './types';

/** Base class for outbound geospatial HTTP integrations. */
export abstract class Service {
  protected config: ServiceConfig | null = null;
  protected apiKey: string | null = null;
  protected accessToken: string | null = null;

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
export abstract class CachedService<TCached> extends Service {
  protected readonly cache;
  protected readonly queue: RequestQueue;

  constructor(private readonly cachedOptions: CachedServiceOptions) {
    super();
    this.cache = new ProviderCache({
      maxEntries: cachedOptions.cacheMaxEntries ?? 1000,
      ttlMs: cachedOptions.cacheTtlMs ?? 30 * 60 * 1000,
      name: cachedOptions.cacheName,
    });
    this.queue = new RequestQueue({
      maxConcurrent: cachedOptions.maxConcurrent ?? 6,
      batchDelayMs: cachedOptions.batchDelayMs ?? 50,
    });
  }

  protected initCredentials(config: ServiceConfig, logPrefix: string): void {
    this.config = config;
    this.apiKey = config.apiKey ?? null;
    this.accessToken = config.accessToken ?? null;
    if (!this.apiKey && !this.accessToken) {
      console.warn(`[${logPrefix}] No credentials provided. API calls will not work.`);
    }
  }

  protected requireApiKey(serviceLabel: string): asserts this is { apiKey: string } {
    if (!this.apiKey) {
      throw new Error(`${serviceLabel}: No API key configured.`);
    }
  }

  protected requireAccessToken(serviceLabel: string): asserts this is { accessToken: string } {
    if (!this.accessToken) {
      throw new Error(`${serviceLabel}: No access token configured.`);
    }
  }

  protected async cachedQueued(cacheKey: string, fn: () => Promise<TCached>): Promise<TCached> {
    const cached = this.cache.get(cacheKey) as TCached | undefined;
    if (cached !== undefined) {
      return cached;
    }

    return this.queue.enqueue(async () => {
      const result = await fn();
      this.cache.set(cacheKey, result);
      return result;
    });
  }

  protected async cachedPlaceSearch(
    options: PlaceSearchOptions,
    cacheKeyPrefix: string,
    extraParts: string[],
    fn: () => Promise<PlaceSearchResult[]>
  ): Promise<PlaceSearchResult[]> {
    if (!options.query && !options.ll) {
      throw new Error(`${this.getName()}: Either query or location (ll) is required`);
    }

    const cacheKey = buildPlaceSearchCacheKey(options, cacheKeyPrefix, extraParts);
    return this.cachedQueued(cacheKey, fn as () => Promise<TCached>) as Promise<PlaceSearchResult[]>;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }
}
