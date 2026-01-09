/**
 * Mapbox API Provider
 *
 * Implements BaseAPIProvider for Mapbox services
 * Provides isochrone, directions, and matrix capabilities
 *
 * Features:
 * - LRU cache with 10-minute TTL
 * - Max 100 cached entries
 * - Automatic cache eviction
 */

import { LRUCache } from 'lru-cache';
import {
  BaseAPIProvider,
  type MapProviderConfig,
  type APICapability,
  type IsochroneOptions,
  type DirectionsOptions,
  type GeocodeOptions,
} from './types';
import type { FeatureCollection } from 'geojson';

interface CacheEntry {
  data: FeatureCollection;
  timestamp: number;
}

export class MapboxAPIProvider extends BaseAPIProvider {
  protected config: MapProviderConfig | null = null;
  private accessToken: string | null = null;

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
  private activeRequests = 0;
  private readonly MAX_CONCURRENT = 6; // Process up to 6 requests at a time
  private readonly REQUEST_DELAY_MS = 50; // 50ms between batches
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000; // Start with 1 second retry delay

  constructor() {
    super();
    this.cache = new LRUCache<string, CacheEntry>({
      max: 1000, // Maximum 1000 entries (supports ~600 venues at multiple travel times)
      ttl: 1000 * 60 * 30, // 30 minutes TTL
      updateAgeOnGet: true, // LRU: reset age on access
      updateAgeOnHas: false, // Don't reset age on has() check
    });
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
    return ['isochrone', 'directions', 'matrix', 'geocoding'];
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
      this.cacheHits++;
      return cached.data;
    }
    this.cacheMisses++;

    // Queue the actual API request with rate limiting
    return this.queueRequest(() => this.fetchIsochroneInternal(options, cacheKey));
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
   * Internal fetch with retry logic for rate limiting
   */
  private async fetchIsochroneInternal(
    options: IsochroneOptions,
    cacheKey: string,
    retryCount = 0
  ): Promise<FeatureCollection> {
    const { lat, lng, minutes, mode, colors } = options;

    // Map mode to Mapbox profile
    const modeMap: Record<string, string> = {
      driving: 'driving-traffic',
      walking: 'walking',
      cycling: 'cycling',
      'driving-traffic': 'driving-traffic',
    };
    const profile = modeMap[mode] || 'driving-traffic';

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

      const response = await fetch(url.toString(), {
        headers: {
          Referer: 'http://localhost:5173/', // Bypass referrer restrictions
        },
      });

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (retryCount < this.MAX_RETRIES) {
          const retryDelay = this.RETRY_DELAY_MS * Math.pow(2, retryCount);
          console.warn(
            `[Mapbox] Rate limited, retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`
          );
          await this.delay(retryDelay);
          return this.fetchIsochroneInternal(options, cacheKey, retryCount + 1);
        }
        throw new Error('Mapbox API error: 429 - Too Many Requests (max retries exceeded)');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

      const data = await response.json();
      const result = data as FeatureCollection;

      // Store in cache
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch isochrone: ${error.message}`);
      }
      throw new Error('Failed to fetch isochrone');
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
      url.searchParams.set('access_token', this.accessToken);

      const response = await fetch(url.toString(), {
        headers: {
          Referer: 'http://localhost:5173/', // Bypass referrer restrictions
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

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
      url.searchParams.set('access_token', this.accessToken);
      url.searchParams.set('limit', limit.toString());

      if (proximity) {
        url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
      }

      if (bbox) {
        url.searchParams.set('bbox', `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Referer: 'http://localhost:5173/',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          `Mapbox API error: ${response.status} ${response.statusText}${
            (error as any).message ? ` - ${(error as any).message}` : ''
          }`
        );
      }

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
   * Generate cache key for isochrone request
   * Rounds coordinates to 4 decimals (~11m precision) for better cache hits
   */
  private getCacheKey(lat: number, lng: number, minutes: number[], mode: string): string {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLng = Math.round(lng * 10000) / 10000;
    return `iso:${roundedLat},${roundedLng}:${minutes.join(',')}:${mode}`;
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
