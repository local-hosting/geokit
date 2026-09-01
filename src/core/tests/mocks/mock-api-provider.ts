import type {
  ServiceCapability,
  Service,
  GeocodeOptions,
  IsochroneOptions,
  ServiceConfig,
  PlaceSearchOptions,
  PlaceSearchResult,
  ReverseGeocodeOptions,
  ReverseGeocodeResult,
} from '@geokit/service/types';
import { polygonAroundPoint } from '../fixtures/geojson';

export type MockIsochroneOptions = {
  lat: number;
  lng: number;
  minutes?: number[];
  time?: number;
  mode?: string;
};

/**
 * Configurable API provider for registry and integration tests.
 * Tracks fetch count and supports in-memory caching like real providers.
 */
export class MockAPIProvider implements Service {
  protected config: ServiceConfig | null = null;
  private initialized = false;
  private readonly cache = new Map<string, GeoJSON.FeatureCollection>();
  private fetchCount = 0;

  geocodeImpl?: (options: GeocodeOptions) => Promise<GeoJSON.FeatureCollection>;
  reverseGeocodeImpl?: (options: ReverseGeocodeOptions) => Promise<ReverseGeocodeResult | null>;
  placeSearchImpl?: (options: PlaceSearchOptions) => Promise<PlaceSearchResult[]>;
  fetchIsochroneImpl?: (options: IsochroneOptions) => Promise<GeoJSON.FeatureCollection>;

  constructor(private readonly capabilities: ServiceCapability[] = ['isochrone']) {}

  getName(): string {
    return 'mock-api';
  }

  async initialize(config: ServiceConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  getCapabilities(): ServiceCapability[] {
    return this.capabilities;
  }

  async fetchIsochrone(options: IsochroneOptions): Promise<GeoJSON.FeatureCollection> {
    if (!this.capabilities.includes('isochrone')) {
      throw new Error('isochrone not supported');
    }
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    if (this.fetchIsochroneImpl) {
      return this.fetchIsochroneImpl(options);
    }

    const legacyTime = (options as IsochroneOptions & { time?: number }).time;
    const cacheKey = [
      options.lat,
      options.lng,
      options.minutes?.join(',') ?? legacyTime,
      options.mode,
    ].join(',');

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    this.fetchCount++;

    const response: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: polygonAroundPoint(options.lat, options.lng),
          properties: {
            time: options.minutes?.[0] ?? legacyTime,
            mode: options.mode,
          },
        },
      ],
    };

    this.cache.set(cacheKey, response);
    return response;
  }

  getFetchCount(): number {
    return this.fetchCount;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getConfig(): ServiceConfig | null {
    return this.config;
  }

  async geocode(options: GeocodeOptions): Promise<GeoJSON.FeatureCollection> {
    if (!this.capabilities.includes('geocoding')) {
      throw new Error('geocoding not supported');
    }
    if (!this.geocodeImpl) {
      throw new Error('geocode not configured');
    }
    return this.geocodeImpl(options);
  }

  async placeSearch(options: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
    if (!this.capabilities.includes('placeSearch')) {
      throw new Error('placeSearch not supported');
    }
    if (!this.placeSearchImpl) {
      throw new Error('placeSearch not configured');
    }
    return this.placeSearchImpl(options);
  }

  async reverseGeocode(options: ReverseGeocodeOptions): Promise<ReverseGeocodeResult | null> {
    if (!this.capabilities.includes('geocoding')) {
      throw new Error('geocoding not supported');
    }
    if (!this.reverseGeocodeImpl) {
      return null;
    }
    return this.reverseGeocodeImpl(options);
  }
}
