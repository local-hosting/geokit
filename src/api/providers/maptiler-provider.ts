/**
 * MapTiler API Provider
 *
 * Implements BaseAPIProvider for MapTiler services
 * Provides geocoding capabilities
 *
 * Features:
 * - LRU cache with 10-minute TTL
 * - Rate limiting support
 */

import { LRUCache } from 'lru-cache';
import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type GeocodeOptions,
} from './types';
import type { FeatureCollection } from 'geojson';

interface CacheEntry {
  data: FeatureCollection;
  timestamp: number;
}

export class MapTilerAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 100 entries, 10-minute TTL
  private cache: LRUCache<string, CacheEntry>;
  private cacheHits = 0;
  private cacheMisses = 0;

  // Rate limiting: queue requests and process with concurrency control
  private requestQueue: Array<{
    resolve: (value: FeatureCollection) => void;
    reject: (error: Error) => void;
    fn: () => Promise<FeatureCollection>;
  }> = [];
  private isProcessingQueue = false;
  private readonly MAX_CONCURRENT = 6; // Process up to 6 requests at a time
  private readonly REQUEST_DELAY_MS = 50; // 50ms between batches
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000; // Start with 1 second retry delay

  constructor() {
    super();
    this.cache = new LRUCache<string, CacheEntry>({
      max: 1000,
      ttl: 1000 * 60 * 30, // 30 minutes TTL
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });
  }

  getName(): string {
    return 'maptiler';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    } else {
      console.warn('MapTiler API Provider: No API key provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    return ['geocoding'];
  }

  /**
   * Geocode a query string to coordinates
   */
  async geocode(options: GeocodeOptions): Promise<FeatureCollection> {
    if (!this.apiKey) {
      throw new Error('MapTiler API Provider: No API key configured.');
    }

    const { query, limit = 5, proximity, bbox } = options;

    if (!query || query.trim().length === 0) {
      throw new Error('MapTiler API Provider: Query string is required for geocoding');
    }

    // Generate cache key
    const cacheKey = `geocode:${query}:${limit}:${proximity ? `${proximity[0]},${proximity[1]}` : ''}:${bbox ? bbox.join(',') : ''}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached.data;
    }
    this.cacheMisses++;

    // Queue the actual API request with rate limiting
    return this.queueRequest(() => this.geocodeInternal(options, cacheKey));
  }

  /**
   * Queue a request for rate-limited execution
   */
  private queueRequest(fn: () => Promise<FeatureCollection>): Promise<FeatureCollection> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, fn });
      this.processQueue();
    });
  }

  /**
   * Process the request queue with concurrent execution
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Take up to MAX_CONCURRENT requests from the queue
      const batch: typeof this.requestQueue = [];
      while (batch.length < this.MAX_CONCURRENT && this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (request) batch.push(request);
      }

      // Execute batch concurrently
      await Promise.all(
        batch.map(async (request) => {
          try {
            const result = await request.fn();
            request.resolve(result);
          } catch (error) {
            request.reject(error instanceof Error ? error : new Error(String(error)));
          }
        })
      );

      // Small delay between batches to avoid overwhelming the API
      if (this.requestQueue.length > 0) {
        await this.delay(this.REQUEST_DELAY_MS);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Internal geocode with retry logic
   */
  private async geocodeInternal(
    options: GeocodeOptions,
    cacheKey: string,
    retryCount = 0
  ): Promise<FeatureCollection> {
    const { query, limit = 5, proximity, bbox } = options;

    try {
      // Build API URL - MapTiler uses URL-encoded query in the path
      const encodedQuery = encodeURIComponent(query);
      const url = new URL(`https://api.maptiler.com/geocoding/${encodedQuery}.json`);
      url.searchParams.set('key', this.apiKey!);
      url.searchParams.set('limit', limit.toString());

      if (proximity) {
        // MapTiler expects [lng, lat] for proximity
        url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
      }

      if (bbox) {
        // MapTiler expects [minLng, minLat, maxLng, maxLat]
        url.searchParams.set('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Referer: 'http://localhost:5173/',
        },
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (retryCount < this.MAX_RETRIES) {
          const retryDelay = this.RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.warn(
            `[MapTiler] Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`
          );
          await this.delay(retryDelay);
          return this.geocodeInternal(options, cacheKey, retryCount + 1);
        }
        throw new Error('MapTiler API error: 429 - Too Many Requests (max retries exceeded)');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `MapTiler API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

      const data = await response.json();

      // MapTiler returns { type: 'FeatureCollection', features: [...] }
      const result = data as FeatureCollection;

      // Store in cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to geocode: ${error.message}`);
      }
      throw new Error('Failed to geocode');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate:
        this.cacheHits + this.cacheMisses > 0
          ? ((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1) + '%'
          : '0%',
    };
  }

  /**
   * Clear the cache (useful for testing or memory pressure)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
