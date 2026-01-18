/**
 * Tests for Foursquare API Provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  _resetRegistries,
} from '../../src/api/providers/registry';
import { FoursquareAPIProvider } from '../../src/api/providers/foursquare-provider';

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
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      consoleSpy.mockRestore();
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
      vi.useFakeTimers();
      // Reset fetch before each test to ensure test isolation
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
      await provider.initialize({ apiKey: 'test-api-key' });
    });

    afterEach(() => {
      vi.useRealTimers();
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

      const promise = provider.placeSearch({ query: 'coffee' });

      // Advance timers to process all retries
      await vi.runAllTimersAsync();

      const results = await promise;

      expect(results).toEqual([]);
      expect(callCount).toBe(3); // 2 rate-limited + 1 success
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

      const promise = provider.placeSearch({ query: 'coffee' });

      // Prevent unhandled rejection warning while timers advance
      promise.catch(() => {});

      // Advance timers to process all retries
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Too Many Requests (max retries exceeded)');

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
