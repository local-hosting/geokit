/**
 * Mapbox API Provider
 *
 * Implements BaseAPIProvider for Mapbox services
 * Provides isochrone, directions, and geocoding capabilities
 *
 * Features:
 * - LRU cache with 30-minute TTL
 * - Max 1000 cached entries
 * - Automatic cache eviction
 */

import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type IsochroneOptions,
  type DirectionsOptions,
  type GeocodeOptions,
  type ReverseGeocodeOptions,
  type ReverseGeocodeResult,
} from './types';
import { ProviderCache, coordinateCacheKey } from './cache';
import { RequestQueue } from './request-queue';
import { assertResponseOk, retryOn429 } from './api-utils';
import type { FeatureCollection } from 'geojson';

const PROVIDER_NAME = 'Mapbox';

export class MapboxAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private accessToken: string | null = null;

  // LRU Cache: 1000 entries, 30-minute TTL
  private cache = new ProviderCache<FeatureCollection>({
    maxEntries: 1000,
    ttlMs: 30 * 60 * 1000,
    name: 'MapboxCache',
  });

  // Rate-limited request queue
  private queue = new RequestQueue({ maxConcurrent: 6, batchDelayMs: 50 });

  constructor() {
    super();
  }

  getName(): string {
    return 'mapbox';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;

    if (config?.accessToken) {
      this.accessToken = config.accessToken;
    } else {
      console.warn('Mapbox API Provider: No access token provided. API calls will not work.');
    }
  }

  getCapabilities(): APICapability[] {
    return ['isochrone', 'directions', 'geocoding'];
  }

  async fetchIsochrone(options: IsochroneOptions): Promise<FeatureCollection> {
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { lat, lng, minutes, mode } = options;

    // Validate inputs
    if (!lat || !lng || !minutes || minutes.length === 0) {
      throw new Error('Mapbox API Provider: Invalid isochrone parameters');
    }

    // Generate cache key (round to 4 decimals = ~11m precision for better cache hits)
    const cacheKey = this.getCacheKey(lat, lng, minutes, mode);

    // Check cache first (synchronous, no rate limiting needed)
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Queue the actual API request with rate limiting
    return this.queue.enqueue(() => this.fetchIsochroneInternal(options, cacheKey));
  }

  /**
   * Internal fetch with retry logic for rate limiting
   */
  private async fetchIsochroneInternal(
    options: IsochroneOptions,
    cacheKey: string
  ): Promise<FeatureCollection> {
    const { lat, lng, minutes, mode, colors } = options;

    // Map mode to Mapbox profile
    // Use 'driving' (not 'driving-traffic') for stable, reproducible isochrones
    const modeMap: Record<string, string> = {
      driving: 'driving',
      walking: 'walking',
      cycling: 'cycling',
      'driving-traffic': 'driving-traffic', // Explicit option if traffic-aware routing is needed
    };
    const profile = modeMap[mode] || 'driving';

    try {
      // Build API URL
      const url = new URL(`https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`);
      url.searchParams.set('contours_minutes', minutes.join(','));
      url.searchParams.set('polygons', 'true');
      url.searchParams.set('denoise', '1'); // Max smoothing
      url.searchParams.set('access_token', this.accessToken!);

      // Add midday departure time for traffic-aware modes
      if (profile === 'driving-traffic') {
        const today = new Date();
        const midday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(today.getDate()).padStart(2, '0')}T12:00`;
        url.searchParams.set('depart_at', midday);
      }

      // Add custom colors if provided
      if (colors && colors.length > 0) {
        const mapboxColors = colors.slice(0, minutes.length).map((c) => c.replace('#', ''));
        url.searchParams.set('contours_colors', mapboxColors.join(','));
      }

      const fetchFn = () =>
        fetch(url.toString(), {
          headers: { Referer: 'http://localhost:5173/' },
        });

      const response = await retryOn429(fetchFn, {
        providerName: PROVIDER_NAME,
      });

      // Handle case where fetch returns undefined (network unavailable)
      if (!response) {
        throw new Error(
          'Network request failed: fetch returned undefined. Network may be unavailable.'
        );
      }

      await assertResponseOk(response, PROVIDER_NAME);

      const data = await response.json();
      const result = data as FeatureCollection;

      // Store in cache
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch isochrone: ${error.message}`);
      }
      // Handle non-Error exceptions (e.g., network failures, fetch not available)
      const errorMessage = error ? String(error) : 'Unknown error';
      throw new Error(`Failed to fetch isochrone: ${errorMessage}`);
    }
  }

  async directions(options: DirectionsOptions): Promise<FeatureCollection> {
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { waypoints, mode = 'driving', alternatives = false } = options;

    if (!waypoints || waypoints.length < 2) {
      throw new Error('Mapbox API Provider: At least 2 waypoints are required for directions');
    }

    // Map mode to Mapbox profile
    const modeMap: Record<string, string> = {
      driving: 'driving-traffic',
      walking: 'walking',
      cycling: 'cycling',
    };
    const profile = modeMap[mode] || 'driving-traffic';

    try {
      // Build coordinates string
      const coordinates = waypoints.map((w) => `${w[0]},${w[1]}`).join(';');

      // Build API URL
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}`);
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('overview', 'full');
      url.searchParams.set('alternatives', alternatives.toString());
      url.searchParams.set('access_token', this.accessToken!);

      const response = await fetch(url.toString(), {
        headers: { Referer: 'http://localhost:5173/' },
      });

      await assertResponseOk(response, PROVIDER_NAME);

      const data = await response.json();

      // Convert routes to GeoJSON FeatureCollection
      const features = (data as any).routes.map((route: any, index: number) => ({
        type: 'Feature',
        properties: {
          duration: route.duration,
          distance: route.distance,
          weight: route.weight,
          routeIndex: index,
        },
        geometry: route.geometry,
      }));

      return {
        type: 'FeatureCollection',
        features,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch directions: ${error.message}`);
      }
      throw new Error('Failed to fetch directions');
    }
  }

  /**
   * Geocode a query string to coordinates
   */
  async geocode(options: GeocodeOptions): Promise<FeatureCollection> {
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { query, limit = 5, proximity, bbox } = options;

    if (!query || query.trim().length === 0) {
      throw new Error('Mapbox API Provider: Query string is required for geocoding');
    }

    try {
      // Build API URL
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
      );
      url.searchParams.set('access_token', this.accessToken!);
      url.searchParams.set('limit', limit.toString());

      if (proximity) {
        url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
      }

      if (bbox) {
        url.searchParams.set('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);
      }

      const response = await fetch(url.toString(), {
        headers: { Referer: 'http://localhost:5173/' },
      });

      await assertResponseOk(response, PROVIDER_NAME);

      const data = await response.json();

      // Mapbox returns { type: 'FeatureCollection', features: [...] }
      return data as FeatureCollection;
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
    if (!this.accessToken) {
      throw new Error('Mapbox API Provider: No access token configured.');
    }

    const { lat, lng, types, limit = 1 } = options;

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      throw new Error('Mapbox API Provider: Valid lat/lng coordinates are required');
    }

    // Generate cache key
    const cacheKey = `revgeo:${lat.toFixed(5)},${lng.toFixed(5)}:${types?.join(',') || ''}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Cache stores FeatureCollection, extract the result
      return this.parseReverseGeocodeResponse(cached, lat, lng);
    }

    try {
      // Mapbox reverse geocoding: pass coordinates as the query
      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`);
      url.searchParams.set('access_token', this.accessToken!);
      url.searchParams.set('limit', limit.toString());

      // Filter by types if specified (e.g., 'postcode' for ZIP codes)
      if (types && types.length > 0) {
        url.searchParams.set('types', types.join(','));
      }

      const response = await fetch(url.toString(), {
        headers: { Referer: 'http://localhost:5173/' },
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
   * Parse Mapbox reverse geocode response into structured result
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

    // Helper to find context item by type prefix
    const findContext = (prefix: string): string | undefined => {
      const item = context.find((c: any) => c.id?.startsWith(prefix));
      return item?.text;
    };

    // Extract postal code - could be in the main feature or context
    let postcode: string | undefined;
    if (feature.id?.startsWith('postcode.')) {
      postcode = feature.text;
    } else {
      postcode = findContext('postcode.');
    }

    // Build the result
    const result: ReverseGeocodeResult = {
      address: feature.place_name,
      streetAddress: feature.id?.startsWith('address.') ? feature.text : findContext('address.'),
      city: findContext('place.') || findContext('locality.'),
      state: findContext('region.'),
      postcode,
      country: findContext('country.'),
      countryCode: context
        .find((c: any) => c.id?.startsWith('country.'))
        ?.short_code?.toUpperCase(),
      neighborhood: findContext('neighborhood.'),
      coordinates: [lng, lat],
      raw: feature,
    };

    return result;
  }

  /**
   * Generate cache key for isochrone request
   * Rounds coordinates to 4 decimals (~11m precision) for better cache hits
   */
  private getCacheKey(lat: number, lng: number, minutes: number[], mode: string): string {
    return coordinateCacheKey(lat, lng, [`iso`, minutes.join(','), mode], 4);
  }

  /**
   * Check if isochrone data is already cached for given options
   * Useful for prefetch optimization - avoid redundant API calls
   */
  hasIsochroneCached(options: IsochroneOptions): boolean {
    const { lat, lng, minutes = [5, 10, 15], mode = 'driving' } = options;
    const cacheKey = this.getCacheKey(lat, lng, minutes, mode);
    return this.cache.has(cacheKey);
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
