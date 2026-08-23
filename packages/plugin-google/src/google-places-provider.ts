/**
 * Google Places API Provider
 *
 * Implements BaseAPIProvider for Google Places API
 * Provides place search for live MCP geocoding.
 *
 * Ratings/reviews → pipeline enrichment ingest → host catalogs.
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type PlaceSearchOptions,
  type PlaceSearchResult,
} from '@geokit/api/types';
import { ProviderCache, buildPlaceSearchCacheKey } from '@geokit/api';
import { RequestQueue } from '@geokit/api';
import { requireAPIKey, fetchWithRetry } from '@geokit/api';
import {
  enrichPlaceSearchResult,
  resolvePlaceSearchCategories,
} from '@geokit/api/place-taxonomy';

const PROVIDER_NAME = 'Google Places';

export class GooglePlacesAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache = new ProviderCache<PlaceSearchResult[]>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'GooglePlacesCache',
  });

  // Rate-limited request queue
  private queue = new RequestQueue({ maxConcurrent: 10, batchDelayMs: 50 });

  constructor() {
    super();
  }

  getName(): string {
    return 'google-places';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.apiKey) {
      this.apiKey = config.apiKey;
    } else {
      console.warn('[gk-api-google-places]  No API key provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    return ['placeSearch'];
  }

  /**
   * Search for places
   */
  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    requireAPIKey(this.apiKey, `${PROVIDER_NAME} API Provider`);

    // Must have either query or ll (location)
    if (!options.query && !options.ll) {
      throw new Error('Google Places API Provider: Either query or location (ll) is required');
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
   * Internal place search
   */
  private async placeSearchInternal(
    options: PlaceSearchOptions,
    cacheKey: string
  ): Promise<PlaceSearchResult[]> {
    const { query, ll, radius, limit = 10 } = options;

    try {
      // Use Find Place API if we have a query, otherwise use Nearby Search
      let url: string;
      const categories = resolvePlaceSearchCategories(options, 'google-places');
      let params: URLSearchParams;

      if (query) {
        // Find Place API - better for text queries
        url = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
        params = new URLSearchParams({
          input: query,
          inputtype: 'textquery',
          fields: 'place_id,name,geometry,formatted_address,rating,user_ratings_total,price_level',
          key: this.apiKey!,
        });

        if (ll) {
          params.set('locationbias', `point:${ll[1]},${ll[0]}`);
        }
      } else if (ll) {
        // Nearby Search API - better for location-based queries
        url = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
        params = new URLSearchParams({
          location: `${ll[1]},${ll[0]}`,
          radius: radius ? radius.toString() : '5000', // Default 5km
          key: this.apiKey!,
        });

        if (limit) {
          params.set('maxresults', Math.min(limit, 20).toString()); // Google max is 20 per request
        }
        if (categories?.length) {
          params.set('type', categories[0]);
        }
      } else {
        throw new Error('Google Places API Provider: Either query or location (ll) is required');
      }

      const fetchFn = () => fetch(`${url}?${params}`);
      const response = await fetchWithRetry(fetchFn, PROVIDER_NAME);

      const data = await response.json();

      // Handle API errors
      if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        throw new Error(
          `Google Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`
        );
      }

      // Transform Google Places response to normalized PlaceSearchResult[]
      const results = this.transformResults(data.candidates || data.results || []).map(
        (result) => enrichPlaceSearchResult(result, 'google-places')
      );

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
   * Transform Google Places API response to normalized PlaceSearchResult[]
   */
  private transformResults(results: any[]): PlaceSearchResult[] {
    return results.map((place) => {
      const geometry = place.geometry;
      const location = geometry?.location;

      return {
        id: place.place_id,
        name: place.name,
        address: place.formatted_address || place.vicinity,
        location: location ? [location.lng, location.lat] : [0, 0],
        categories: place.types
          ? place.types.filter((t: string) => !t.startsWith('point_of_interest'))
          : [],
        distance: place.distance,
        rating: place.rating,
        priceLevel: place.price_level,
        hours: place.opening_hours
          ? {
              openNow: place.opening_hours.open_now,
              display: place.opening_hours.weekday_text?.join(', '),
            }
          : undefined,
        contact: {
          phone: place.formatted_phone_number || place.international_phone_number,
          website: place.website,
        },
        raw: place,
      };
    });
  }

  /**
   * Generate cache key for place search request
   */
  private getCacheKey(options: PlaceSearchOptions): string {
    return buildPlaceSearchCacheKey(options, 'gplaces', [
      ...(options.sort ? [`sort:${options.sort}`] : []),
      ...(options.openNow !== undefined ? [`open:${options.openNow}`] : []),
    ]);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Parse relative date description to approximate ISO date string
   * Converts "2 months ago", "a week ago", etc. to approximate dates
   */
  private parseRelativeDate(relative: string): string {
    const now = new Date();
    const lower = relative.toLowerCase().trim();

    // Handle "a month ago", "an hour ago", etc.
    const aMatch = lower.match(/^a[n]?\s+(\w+)\s+ago$/);
    if (aMatch) {
      const unit = aMatch[1];
      return this.subtractTime(now, 1, unit);
    }

    // Handle "2 months ago", "3 weeks ago", etc.
    const numberMatch = lower.match(/^(\d+)\s+(\w+)\s+ago$/);
    if (numberMatch) {
      const amount = parseInt(numberMatch[1], 10);
      const unit = numberMatch[2];
      return this.subtractTime(now, amount, unit);
    }

    // If we can't parse it, return undefined (will be omitted from result)
    return undefined as unknown as string;
  }

  /**
   * Subtract time from a date
   */
  private subtractTime(date: Date, amount: number, unit: string): string {
    const result = new Date(date);
    const unitLower = unit.toLowerCase();

    if (unitLower.includes('second')) {
      result.setSeconds(result.getSeconds() - amount);
    } else if (unitLower.includes('minute')) {
      result.setMinutes(result.getMinutes() - amount);
    } else if (unitLower.includes('hour')) {
      result.setHours(result.getHours() - amount);
    } else if (unitLower.includes('day')) {
      result.setDate(result.getDate() - amount);
    } else if (unitLower.includes('week')) {
      result.setDate(result.getDate() - amount * 7);
    } else if (unitLower.includes('month')) {
      result.setMonth(result.getMonth() - amount);
    } else if (unitLower.includes('year')) {
      result.setFullYear(result.getFullYear() - amount);
    }

    return result.toISOString();
  }

  /**
   * Clear the cache (useful for testing or memory pressure)
   */
  clearCache(): void {
    this.cache.clear();
  }
}
