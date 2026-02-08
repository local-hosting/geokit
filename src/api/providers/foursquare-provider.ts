/**
 * Foursquare API Provider
 *
 * Implements BaseAPIProvider for Foursquare Places API v3
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
      console.warn('Foursquare API Provider: No API key provided. API calls will not work.');
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
      url.searchParams.set(
        'fields',
        'fsq_id,name,geocodes,location,categories,distance,rating,price,hours,tel,website'
      );

      const fetchFn = () =>
        fetch(url.toString(), {
          headers: {
            Authorization: this.apiKey!,
            Accept: 'application/json',
          },
        });

      const response = await retryOn429(fetchFn, {
        providerName: PROVIDER_NAME,
      });

      await assertResponseOk(response, PROVIDER_NAME);

      const data = await response.json();

      // Transform Foursquare response to normalized PlaceSearchResult[]
      const results = this.transformResults(data.results || []);

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
