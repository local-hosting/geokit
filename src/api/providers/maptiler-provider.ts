/**
 * MapTiler API Provider
 *
 * Implements BaseAPIProvider for MapTiler services
 * Provides geocoding capabilities
 *
 * Features:
 * - LRU cache with 30-minute TTL
 * - Rate limiting support
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type GeocodeOptions,
  type ReverseGeocodeOptions,
  type ReverseGeocodeResult,
} from './types';
import { ProviderCache, coordinateCacheKey } from './cache';
import type { FeatureCollection } from 'geojson';

export class MapTilerAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache = new ProviderCache<FeatureCollection>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'MapTilerCache',
  });

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
      return cached;
    }

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
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to geocode: ${error.message}`);
      }
      throw new Error('Failed to geocode');
    }
  }

  /**
   * Reverse geocode coordinates to address information
   * Returns postal code, address, city, state, etc.
   */
  async reverseGeocode(options: ReverseGeocodeOptions): Promise<ReverseGeocodeResult | null> {
    if (!this.apiKey) {
      throw new Error('MapTiler API Provider: No API key configured.');
    }

    const { lat, lng, types, limit = 1 } = options;

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      throw new Error('MapTiler API Provider: Valid lat/lng coordinates are required');
    }

    // Generate cache key
    const cacheKey = coordinateCacheKey(lat, lng, ['revgeo', types?.join(',') || ''], 5);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return this.parseReverseGeocodeResponse(cached, lat, lng);
    }

    try {
      // MapTiler reverse geocoding: pass coordinates as the query (lng,lat format)
      const url = new URL(`https://api.maptiler.com/geocoding/${lng},${lat}.json`);
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('limit', limit.toString());

      // Filter by types if specified (e.g., 'postal_code' for ZIP codes)
      // MapTiler uses different type names than Mapbox
      if (types && types.length > 0) {
        // Map common type names to MapTiler equivalents
        const mappedTypes = types.map((t) => {
          if (t === 'postcode') return 'postal_code';
          if (t === 'address') return 'street';
          if (t === 'place') return 'municipality';
          if (t === 'region') return 'county,region';
          return t;
        });
        url.searchParams.set('types', mappedTypes.join(','));
      }

      const response = await fetch(url.toString(), {
        headers: {
          Referer: 'http://localhost:5173/',
        },
      });

      // Handle rate limiting
      if (response.status === 429) {
        console.warn('[MapTiler] Rate limited for reverse geocode');
        throw new Error('MapTiler API error: 429 - Too Many Requests');
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
      const featureCollection = data as FeatureCollection;

      // Cache the raw response
      this.cache.set(cacheKey, featureCollection);

      return this.parseReverseGeocodeResponse(featureCollection, lat, lng);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to reverse geocode: ${error.message}`);
      }
      throw new Error('Failed to reverse geocode');
    }
  }

  /**
   * Parse MapTiler reverse geocode response into structured result
   */
  private parseReverseGeocodeResponse(
    data: FeatureCollection,
    lat: number,
    lng: number
  ): ReverseGeocodeResult | null {
    if (!data.features || data.features.length === 0) {
      return null;
    }

    const feature = data.features[0] as any;
    const context = feature.context || [];

    // Helper to find context item by type
    const findContext = (placeType: string): string | undefined => {
      // Check if the main feature is of this type
      if (feature.place_type?.includes(placeType)) {
        return feature.text;
      }
      // Check context array
      const item = context.find((c: any) => c.id?.startsWith(placeType + '.'));
      return item?.text;
    };

    // Extract postal code - MapTiler uses 'postal_code' type
    let postcode: string | undefined;
    if (feature.place_type?.includes('postal_code')) {
      postcode = feature.text;
    } else {
      postcode = findContext('postal_code');
    }

    // Build the result
    const result: ReverseGeocodeResult = {
      address: feature.place_name,
      streetAddress: findContext('street') || findContext('address'),
      city: findContext('municipality') || findContext('place') || findContext('locality'),
      state: findContext('region'),
      postcode,
      country: findContext('country'),
      countryCode: context
        .find((c: any) => c.id?.startsWith('country.'))
        ?.short_code?.toUpperCase(),
      neighborhood: findContext('neighbourhood') || findContext('neighborhood'),
      coordinates: [lng, lat],
      raw: feature,
    };

    return result;
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
