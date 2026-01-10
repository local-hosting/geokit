/**
 * Foursquare API Provider
 *
 * Implements BaseAPIProvider for Foursquare Places API v3
 * Provides place search capabilities
 *
 * Features:
 * - LRU cache with 30-minute TTL
 * - Rate limiting support with exponential backoff
 */

import { LRUCache } from 'lru-cache';
import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type PlaceSearchOptions,
  type PlaceSearchResult,
} from './types';

interface CacheEntry {
  data: PlaceSearchResult[];
  timestamp: number;
}

export class FoursquareAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache: LRUCache<string, CacheEntry>;
  private cacheHits = 0;
  private cacheMisses = 0;

  // Rate limiting: queue requests and process with concurrency control
  private requestQueue: Array<{
    resolve: (value: PlaceSearchResult[]) => void;
    reject: (error: Error) => void;
    fn: () => Promise<PlaceSearchResult[]>;
  }> = [];
  private isProcessingQueue = false;
  private readonly MAX_CONCURRENT = 6;
  private readonly REQUEST_DELAY_MS = 50;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

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
    return 'foursquare';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    } else {
      console.warn('Foursquare API Provider: No API key provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    return ['placeSearch'];
  }

  /**
   * Search for places/venues
   */
  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Foursquare API Provider: No API key configured.');
    }

    // Must have either query or ll (location)
    if (!options.query && !options.ll) {
      throw new Error('Foursquare API Provider: Either query or location (ll) is required');
    }

    // Generate cache key
    const cacheKey = this.getCacheKey(options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached.data;
    }
    this.cacheMisses++;

    // Queue the actual API request with rate limiting
    return this.queueRequest(() => this.placeSearchInternal(options, cacheKey));
  }

  /**
   * Queue a request for rate-limited execution
   */
  private queueRequest(fn: () => Promise<PlaceSearchResult[]>): Promise<PlaceSearchResult[]> {
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
   * Internal place search with retry logic
   */
  private async placeSearchInternal(
    options: PlaceSearchOptions,
    cacheKey: string,
    retryCount = 0
  ): Promise<PlaceSearchResult[]> {
    const { query, ll, radius, categories, limit = 10, sort, openNow, minPrice, maxPrice } = options;

    try {
      // Build API URL - Foursquare Places API v3
      const url = new URL('https://api.foursquare.com/v3/places/search');

      if (query) {
        url.searchParams.set('query', query);
      }

      if (ll) {
        // Foursquare expects "lat,lng" format
        url.searchParams.set('ll', `${ll[1]},${ll[0]}`);
      }

      if (radius) {
        url.searchParams.set('radius', radius.toString());
      }

      if (categories && categories.length > 0) {
        url.searchParams.set('categories', categories.join(','));
      }

      url.searchParams.set('limit', Math.min(limit, 50).toString()); // Foursquare max is 50

      if (sort) {
        url.searchParams.set('sort', sort);
      }

      if (openNow !== undefined) {
        url.searchParams.set('open_now', openNow.toString());
      }

      if (minPrice !== undefined) {
        url.searchParams.set('min_price', minPrice.toString());
      }

      if (maxPrice !== undefined) {
        url.searchParams.set('max_price', maxPrice.toString());
      }

      // Add fields to get more details
      url.searchParams.set('fields', 'fsq_id,name,geocodes,location,categories,distance,rating,price,hours,tel,website');

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: this.apiKey!,
          Accept: 'application/json',
        },
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (retryCount < this.MAX_RETRIES) {
          const retryDelay = this.RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.warn(
            `[Foursquare] Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`
          );
          await this.delay(retryDelay);
          return this.placeSearchInternal(options, cacheKey, retryCount + 1);
        }
        throw new Error('Foursquare API error: 429 - Too Many Requests (max retries exceeded)');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Foursquare API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

      const data = await response.json();

      // Transform Foursquare response to normalized PlaceSearchResult[]
      const results = this.transformResults(data.results || []);

      // Store in cache
      this.cache.set(cacheKey, {
        data: results,
        timestamp: Date.now(),
      });

      return results;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search places: ${error.message}`);
      }
      throw new Error('Failed to search places');
    }
  }

  /**
   * Transform Foursquare API response to normalized PlaceSearchResult[]
   */
  private transformResults(results: any[]): PlaceSearchResult[] {
    return results.map((place) => {
      const geocodes = place.geocodes?.main;
      const location = place.location;

      return {
        id: place.fsq_id,
        name: place.name,
        address: this.formatAddress(location),
        location: geocodes ? [geocodes.longitude, geocodes.latitude] : [0, 0],
        categories: place.categories?.map((cat: any) => cat.name) || [],
        distance: place.distance,
        rating: place.rating,
        priceLevel: place.price,
        hours: place.hours
          ? {
              openNow: place.hours.open_now,
              display: place.hours.display,
            }
          : undefined,
        contact: {
          phone: place.tel,
          website: place.website,
        },
        raw: place,
      };
    });
  }

  /**
   * Format address from Foursquare location object
   */
  private formatAddress(location: any): string | undefined {
    if (!location) return undefined;

    const parts: string[] = [];

    if (location.address) {
      parts.push(location.address);
    }
    if (location.locality) {
      parts.push(location.locality);
    }
    if (location.region) {
      parts.push(location.region);
    }
    if (location.postcode) {
      parts.push(location.postcode);
    }

    return parts.length > 0 ? parts.join(', ') : location.formatted_address;
  }

  /**
   * Generate cache key for place search request
   */
  private getCacheKey(options: PlaceSearchOptions): string {
    const parts: string[] = ['fsq'];

    if (options.query) {
      parts.push(`q:${options.query}`);
    }
    if (options.ll) {
      // Round to 3 decimals (~111m precision) for cache key
      const roundedLat = Math.round(options.ll[1] * 1000) / 1000;
      const roundedLng = Math.round(options.ll[0] * 1000) / 1000;
      parts.push(`ll:${roundedLat},${roundedLng}`);
    }
    if (options.radius) {
      parts.push(`r:${options.radius}`);
    }
    if (options.categories && options.categories.length > 0) {
      parts.push(`cat:${options.categories.join(',')}`);
    }
    if (options.limit) {
      parts.push(`lim:${options.limit}`);
    }
    if (options.sort) {
      parts.push(`sort:${options.sort}`);
    }
    if (options.openNow !== undefined) {
      parts.push(`open:${options.openNow}`);
    }
    if (options.minPrice !== undefined) {
      parts.push(`minp:${options.minPrice}`);
    }
    if (options.maxPrice !== undefined) {
      parts.push(`maxp:${options.maxPrice}`);
    }

    return parts.join(':');
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

