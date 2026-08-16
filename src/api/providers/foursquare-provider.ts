/**
 * Foursquare API Provider
 *
 * Implements BaseAPIProvider for Foursquare Places API (places-api.foursquare.com)
 * Provides place search capabilities
 *
 * Features:
 * - LRU cache with 30-minute TTL
 * - Rate limiting support with exponential backoff
 *
 * Note: Behavioral/ratings API was deprecated by Foursquare - use placeSearch only
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type PlaceSearchOptions,
  type PlaceSearchResult,
} from './types';
import { ProviderCache, coordinateCacheKey } from './cache';
import { RequestQueue } from './request-queue';
import { requireAPIKey, assertResponseOk, retryOn429 } from './api-utils';
import {
  buildFoursquarePlacesSearchUrl,
  foursquarePlacesHeaders,
  normalizeFoursquarePlace,
} from './foursquare-places';
import type { FoursquarePlaceRaw } from '../../types/foursquare-places';

const PROVIDER_NAME = 'Foursquare';

export class FoursquareAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache = new ProviderCache<PlaceSearchResult[]>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'FoursquareCache',
  });

  // Rate-limited request queue
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

  constructor() {
    super();
  }

  getName(): string {
    return 'foursquare';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    } else {
      console.warn('[gk-api-foursquare]  No API key provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    // Note: 'behavioral' capability removed - Foursquare deprecated their ratings/popularity API
    return ['placeSearch'];
  }

  /**
   * Search for places/venues
   */
  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    requireAPIKey(this.apiKey, `${PROVIDER_NAME} API Provider`);

    // Must have either query or ll (location)
    if (!options.query && !options.ll) {
      throw new Error('Foursquare API Provider: Either query or location (ll) is required');
    }

    // Generate cache key
    const cacheKey = this.getCacheKey(options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Queue the actual API request with rate limiting
    return this.queue.enqueue(() => this.placeSearchInternal(options, cacheKey));
  }

  /**
   * Internal place search with retry logic
   */
  private async placeSearchInternal(
    options: PlaceSearchOptions,
    cacheKey: string
  ): Promise<PlaceSearchResult[]> {
    const {
      query,
      ll,
      radius,
      categories,
      limit = 10,
      sort,
      openNow,
      minPrice,
      maxPrice,
    } = options;

    try {
      const url = buildFoursquarePlacesSearchUrl({
        query,
        ll,
        radius,
        categories,
        limit,
        sort,
        openNow,
        minPrice,
        maxPrice,
        fields:
          'fsq_place_id,name,location,latitude,longitude,categories,distance,rating,price,hours,tel,website',
      });

      const fetchFn = () =>
        fetch(url.toString(), {
          headers: foursquarePlacesHeaders(this.apiKey!),
        });

      const response = await retryOn429(fetchFn, {
        providerName: PROVIDER_NAME,
      });

      await assertResponseOk(response, PROVIDER_NAME);

      const data = (await response.json()) as { results?: unknown[] };

      const results = (data.results ?? []).map((place) => {
        const normalized = normalizeFoursquarePlace(place as FoursquarePlaceRaw);
        return {
          id: normalized.id,
          name: normalized.name,
          address: normalized.address,
          location: normalized.location,
          categories: normalized.categories ?? [],
          distance: normalized.distance,
          rating: normalized.rating,
          priceLevel: normalized.priceLevel,
          hours: normalized.hours,
          contact: normalized.contact,
          raw: normalized.raw,
        };
      });

      // Store in cache
      this.cache.set(cacheKey, results);

      return results;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to search places: ${error.message}`);
      }
      throw new Error('Failed to search places');
    }
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
      parts.push(`ll:${coordinateCacheKey(options.ll[1], options.ll[0], [], 3)}`);
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
    return this.cache.getStats();
  }

  /**
   * Clear the cache (useful for testing or memory pressure)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
