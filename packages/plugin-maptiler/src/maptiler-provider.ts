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
} from '@geokit/api/types';
import { ProviderCache, coordinateCacheKey } from '@geokit/api';
import { RequestQueue } from '@geokit/api';
import { requireAPIKey, assertResponseOk, retryOn429 } from '@geokit/api';
import type { FeatureCollection } from 'geojson';

const PROVIDER_NAME = 'MapTiler';

export class MapTilerAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private apiKey: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache = new ProviderCache<FeatureCollection>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'MapTilerCache',
  });

  // Rate-limited request queue
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

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
      console.warn('[gk-api-maptiler]  No API key provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    return ['geocoding'];
  }

  /**
   * Geocode a query string to coordinates
   */
  async geocode(options: GeocodeOptions): Promise<FeatureCollection> {
    requireAPIKey(this.apiKey, `${PROVIDER_NAME} API Provider`);

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
    return this.queue.enqueue(() => this.geocodeInternal(options, cacheKey));
  }

  /**
   * Internal geocode with retry logic
   */
  private async geocodeInternal(
    options: GeocodeOptions,
    cacheKey: string
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

      const fetchFn = () =>
        fetch(url.toString(), {
          headers: { Referer: 'http://localhost:5173/' },
        });

      const response = await retryOn429(fetchFn, {
        providerName: PROVIDER_NAME,
      });

      await assertResponseOk(response, PROVIDER_NAME);

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
    requireAPIKey(this.apiKey, `${PROVIDER_NAME} API Provider`);

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
      url.searchParams.set('key', this.apiKey!);
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

      const fetchFn = () =>
        fetch(url.toString(), {
          headers: { Referer: 'http://localhost:5173/' },
        });

      const response = await retryOn429(fetchFn, {
        providerName: PROVIDER_NAME,
      });

      await assertResponseOk(response, PROVIDER_NAME);

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
