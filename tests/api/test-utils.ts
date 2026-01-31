/**
 * Test utilities for API provider tests
 */

import type {
  BaseAPIProvider,
  APICapability,
  MapProviderConfig,
} from '../../src/api/providers/types';

/**
 * Mock API provider for testing registry and provider functionality
 */
export class MockAPIProvider implements BaseAPIProvider {
  private config: MapProviderConfig | null = null;
  private initialized = false;
  private capabilities: APICapability[];
  private cache = new Map<string, any>();
  private fetchCount = 0;

  constructor(capabilities: APICapability[] = ['isochrone']) {
    this.capabilities = capabilities;
  }

  getName(): string {
    return 'mock-api';
  }

  async initialize(config: MapProviderConfig): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  getCapabilities(): APICapability[] {
    return this.capabilities;
  }

  async fetchIsochrone(options: any): Promise<GeoJSON.FeatureCollection> {
    if (!this.initialized) throw new Error('Provider not initialized');

    // Check cache first (before incrementing)
    const cacheKey = `${options.lat},${options.lng},${options.minutes?.join(',') || options.time},${options.mode}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey); // Cache hit - don't increment
    }

    // Only increment on actual fetch
    this.fetchCount++;

    // Simulate API response
    const response: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
          properties: {},
        },
      ],
    };

    // Store in cache
    this.cache.set(cacheKey, response);
    return response;
  }

  getFetchCount(): number {
    return this.fetchCount;
  }
}
