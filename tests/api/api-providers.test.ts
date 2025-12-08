import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  getAPIProvider,
  _resetRegistries,
} from '../../src/api/providers/registry';
import type { BaseAPIProvider, APICapability, MapProviderConfig } from '../../src/api/providers/types';

// Mock API provider for testing
class MockAPIProvider implements BaseAPIProvider {
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
            coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
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

describe('API Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
  });

  describe('registerAPIProvider', () => {
    it('should register a new API provider', () => {
      const provider = new MockAPIProvider(['isochrone']);
      expect(() => registerAPIProvider('test-api', provider)).not.toThrow();
    });

    it('should allow registering multiple providers', () => {
      const provider1 = new MockAPIProvider(['isochrone']);
      const provider2 = new MockAPIProvider(['geocoding']);
      
      expect(() => registerAPIProvider('provider1', provider1)).not.toThrow();
      expect(() => registerAPIProvider('provider2', provider2)).not.toThrow();
    });

    it('should index capabilities automatically', () => {
      const provider = new MockAPIProvider(['isochrone', 'directions']);
      registerAPIProvider('multi-cap', provider);

      const isoProvider = getProviderForCapability('isochrone');
      const dirProvider = getProviderForCapability('directions');
      
      expect(isoProvider?.getName()).toBe('mock-api');
      expect(dirProvider?.getName()).toBe('mock-api');
    });
  });

  describe('initAPIProvider', () => {
    it('should initialize a registered provider', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerAPIProvider('test', provider);

      const result = await initAPIProvider('test', { accessToken: 'test-token' });
      expect(result).toBe(provider);
    });

    it('should throw if provider is not registered', async () => {
      await expect(initAPIProvider('non-existent')).rejects.toThrow();
    });

    it('should initialize provider with config', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      const initSpy = vi.spyOn(provider, 'initialize');
      registerAPIProvider('test', provider);

      await initAPIProvider('test', { accessToken: 'test-token' });
      expect(initSpy).toHaveBeenCalledWith({ accessToken: 'test-token' });
    });
  });

  describe('getProviderForCapability', () => {
    it('should return provider with requested capability', () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerAPIProvider('iso-provider', provider);

      const result = getProviderForCapability('isochrone');
      expect(result?.getName()).toBe('mock-api');
    });

    it('should return null if no provider has capability', () => {
      const provider = new MockAPIProvider(['geocoding']);
      registerAPIProvider('geocode-provider', provider);

      const result = getProviderForCapability('isochrone');
      expect(result).toBeNull();
    });

    it('should return first provider if multiple have capability', () => {
      const provider1 = new MockAPIProvider(['isochrone']);
      const provider2 = new MockAPIProvider(['isochrone']);
      
      registerAPIProvider('provider1', provider1);
      registerAPIProvider('provider2', provider2);

      const result = getProviderForCapability('isochrone');
      expect(result).toBe(provider1);
    });

    it('should handle multiple capabilities per provider', () => {
      const provider = new MockAPIProvider(['isochrone', 'directions', 'matrix']);
      registerAPIProvider('multi-cap', provider);

      expect(getProviderForCapability('isochrone')?.getName()).toBe('mock-api');
      expect(getProviderForCapability('directions')?.getName()).toBe('mock-api');
      expect(getProviderForCapability('matrix')?.getName()).toBe('mock-api');
    });
  });

  describe('getAPIProvider', () => {
    it('should return provider by name', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerAPIProvider('test', provider);
      await initAPIProvider('test');

      const result = getAPIProvider('test');
      expect(result?.getName()).toBe('mock-api');
    });

    it('should return null if provider not found', () => {
      const result = getAPIProvider('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('provider API methods', () => {
    it('should fetch isochrone after initialization', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerAPIProvider('test', provider);
      await initAPIProvider('test', { accessToken: 'test-token' });

      const result = await provider.fetchIsochrone?.({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe('FeatureCollection');
      expect(result?.features).toHaveLength(1);
    });

    it('should throw if calling API before initialization', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      
      await expect(
        provider.fetchIsochrone?.({ lat: 0, lng: 0, minutes: [15], mode: 'driving' })
      ).rejects.toThrow('Provider not initialized');
    });

    it('should use LRU cache for repeated requests', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerAPIProvider('cache-test', provider);
      await initAPIProvider('cache-test');

      const options = { lat: 40.7128, lng: -74.006, minutes: [15], mode: 'driving' as const };

      // First call - cache miss
      await provider.fetchIsochrone?.(options);
      expect(provider.getFetchCount()).toBe(1);

      // Second call with exact same params - cache hit
      await provider.fetchIsochrone?.(options);
      expect(provider.getFetchCount()).toBe(1); // Still 1 - cached!

      // Different params - cache miss
      await provider.fetchIsochrone?.({ ...options, minutes: [30] });
      expect(provider.getFetchCount()).toBe(2);
    });
  });

  describe('capability routing scenarios', () => {
    it('should route different capabilities to different providers', async () => {
      const isoProvider = new MockAPIProvider(['isochrone']);
      const geocodeProvider = new MockAPIProvider(['geocoding']);
      
      registerAPIProvider('iso', isoProvider);
      registerAPIProvider('geocode', geocodeProvider);
      await initAPIProvider('iso');
      await initAPIProvider('geocode');

      const iso = getProviderForCapability('isochrone');
      const geocode = getProviderForCapability('geocoding');

      expect(iso).toBe(isoProvider);
      expect(geocode).toBe(geocodeProvider);
    });

    it('should handle provider with overlapping capabilities', () => {
      const provider1 = new MockAPIProvider(['isochrone', 'geocoding']);
      const provider2 = new MockAPIProvider(['geocoding', 'directions']);
      
      registerAPIProvider('provider1', provider1);
      registerAPIProvider('provider2', provider2);

      // First provider should be returned for isochrone
      expect(getProviderForCapability('isochrone')).toBe(provider1);
      
      // First provider should be returned for geocoding (provider1 registered first)
      expect(getProviderForCapability('geocoding')).toBe(provider1);
      
      // Second provider should be returned for directions
      expect(getProviderForCapability('directions')).toBe(provider2);
    });
  });
});




