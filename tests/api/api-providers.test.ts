import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  getAPIProvider,
  _resetRegistries,
} from '../../src/api/providers/registry';
import type { BaseAPIProvider, APICapability, MapProviderConfig } from '../../src/api/providers/types';
import { FoursquareAPIProvider } from '../../src/api/providers/foursquare-provider';

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

describe('FoursquareAPIProvider', () => {
  let provider: FoursquareAPIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    provider = new FoursquareAPIProvider();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('foursquare');
    });

    it('should have placeSearch capability', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('placeSearch');
    });

    it('should initialize with API key', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      // No error thrown means success
    });

    it('should warn when no API key provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Foursquare API Provider: No API key provided. API calls will not work.'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('placeSearch validation', () => {
    it('should throw error when not initialized with API key', async () => {
      await provider.initialize({});
      await expect(provider.placeSearch({ query: 'coffee' })).rejects.toThrow(
        'Foursquare API Provider: No API key configured.'
      );
    });

    it('should throw error when neither query nor location provided', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(provider.placeSearch({})).rejects.toThrow(
        'Foursquare API Provider: Either query or location (ll) is required'
      );
    });
  });

  describe('placeSearch with mocked fetch', () => {
    const mockResponse = {
      results: [
        {
          fsq_id: 'test-venue-123',
          name: 'Test Coffee Shop',
          geocodes: {
            main: {
              latitude: 40.7128,
              longitude: -74.006,
            },
          },
          location: {
            address: '123 Main St',
            locality: 'New York',
            region: 'NY',
            postcode: '10001',
          },
          categories: [{ name: 'Coffee Shop' }, { name: 'Cafe' }],
          distance: 150,
          rating: 8.5,
          price: 2,
          hours: {
            open_now: true,
            display: 'Open until 10 PM',
          },
          tel: '555-1234',
          website: 'https://example.com',
        },
      ],
    };

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    });

    it('should search places with query', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      const results = await provider.placeSearch({ query: 'coffee' });
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('test-venue-123');
      expect(results[0].name).toBe('Test Coffee Shop');
      expect(results[0].location).toEqual([-74.006, 40.7128]);
      expect(results[0].categories).toContain('Coffee Shop');
      expect(results[0].distance).toBe(150);
      expect(results[0].rating).toBe(8.5);
    });

    it('should search places with location', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      const results = await provider.placeSearch({ ll: [-74.006, 40.7128] });
      
      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalled();
      
      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('ll')).toBe('40.7128,-74.006');
    });

    it('should include optional parameters in request', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      await provider.placeSearch({
        query: 'pizza',
        ll: [-74.006, 40.7128],
        radius: 1000,
        categories: ['13065'],
        limit: 20,
        sort: 'DISTANCE',
        openNow: true,
        minPrice: 1,
        maxPrice: 3,
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      
      expect(url.searchParams.get('query')).toBe('pizza');
      expect(url.searchParams.get('radius')).toBe('1000');
      expect(url.searchParams.get('categories')).toBe('13065');
      expect(url.searchParams.get('limit')).toBe('20');
      expect(url.searchParams.get('sort')).toBe('DISTANCE');
      expect(url.searchParams.get('open_now')).toBe('true');
      expect(url.searchParams.get('min_price')).toBe('1');
      expect(url.searchParams.get('max_price')).toBe('3');
    });

    it('should use cache for repeated requests', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      const options = { query: 'coffee', ll: [-74.006, 40.7128] as [number, number] };
      
      // First call
      await provider.placeSearch(options);
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Second call with same options - should hit cache
      await provider.placeSearch(options);
      expect(fetch).toHaveBeenCalledTimes(1);
      
      // Different query - should fetch again
      await provider.placeSearch({ query: 'pizza', ll: [-74.006, 40.7128] as [number, number] });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should send correct authorization header', async () => {
      await provider.initialize({ apiKey: 'my-secret-key' });
      
      await provider.placeSearch({ query: 'coffee' });
      
      const fetchCall = (fetch as any).mock.calls[0];
      expect(fetchCall[1].headers.Authorization).toBe('my-secret-key');
    });

    it('should transform response to PlaceSearchResult format', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      const results = await provider.placeSearch({ query: 'coffee' });
      
      expect(results[0]).toMatchObject({
        id: 'test-venue-123',
        name: 'Test Coffee Shop',
        address: '123 Main St, New York, NY, 10001',
        location: [-74.006, 40.7128],
        categories: ['Coffee Shop', 'Cafe'],
        distance: 150,
        rating: 8.5,
        priceLevel: 2,
        hours: {
          openNow: true,
          display: 'Open until 10 PM',
        },
        contact: {
          phone: '555-1234',
          website: 'https://example.com',
        },
      });
      expect(results[0].raw).toBeDefined();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
    });

    it('should handle 429 rate limiting with retries', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ results: [] }),
        });
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const results = await provider.placeSearch({ query: 'coffee' });
      
      expect(results).toEqual([]);
      expect(callCount).toBe(3); // 2 retries + 1 success
      consoleSpy.mockRestore();
    });

    it('should throw after max retries on rate limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({}),
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(provider.placeSearch({ query: 'coffee' })).rejects.toThrow(
        'Too Many Requests (max retries exceeded)'
      );
      
      expect(fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      consoleSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid parameter' }),
      });

      await expect(provider.placeSearch({ query: 'coffee' })).rejects.toThrow(
        'Foursquare API error: 400 Bad Request - Invalid parameter'
      );
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      // Initial call
      await provider.placeSearch({ query: 'coffee' });
      
      let stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);
      
      // Cached call
      await provider.placeSearch({ query: 'coffee' });
      
      stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should clear cache', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await provider.placeSearch({ query: 'coffee' });
      
      let stats = provider.getCacheStats();
      expect(stats.size).toBe(1);
      
      provider.clearCache();
      
      stats = provider.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('integration with registry', () => {
    it('should register and route placeSearch capability', async () => {
      registerAPIProvider('foursquare', provider);
      await initAPIProvider('foursquare', { apiKey: 'test-key' });

      const foundProvider = getProviderForCapability('placeSearch');
      expect(foundProvider?.getName()).toBe('foursquare');
    });
  });
});




