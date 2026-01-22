/**
 * Tests for Google Places API Provider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  _resetRegistries,
} from '../../src/api/providers/registry';
import { GooglePlacesAPIProvider } from '../../src/api/providers/google-places-provider';

describe('GooglePlacesAPIProvider', () => {
  let provider: GooglePlacesAPIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    provider = new GooglePlacesAPIProvider();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('google-places');
    });

    it('should have placeSearch, ratings, and reviews capabilities', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('placeSearch');
      expect(capabilities).toContain('ratings');
      expect(capabilities).toContain('reviews');
    });

    it('should initialize with API key', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      // No error thrown means success
    });

    it('should warn when no API key provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Google Places API Provider: No API key provided. API calls will not work.'
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
        'Google Places API Provider: No API key configured.'
      );
    });

    it('should throw error when neither query nor location provided', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(provider.placeSearch({})).rejects.toThrow(
        'Google Places API Provider: Either query or location (ll) is required'
      );
    });
  });

  describe('placeSearch with mocked fetch', () => {
    const mockResponse = {
      candidates: [
        {
          place_id: 'test-place-123',
          name: 'Test Coffee Shop',
          geometry: {
            location: {
              lat: 40.7128,
              lng: -74.006,
            },
          },
          formatted_address: '123 Main St, New York, NY 10001',
          types: ['cafe', 'establishment'],
          rating: 4.5,
          user_rating_total: 150,
          price_level: 2,
          opening_hours: {
            open_now: true,
          },
          formatted_phone_number: '555-1234',
          website: 'https://example.com',
        },
      ],
      status: 'OK',
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
      expect(results[0].id).toBe('test-place-123');
      expect(results[0].name).toBe('Test Coffee Shop');
      expect(results[0].location).toEqual([-74.006, 40.7128]);
      expect(results[0].categories).toContain('cafe');
      expect(results[0].rating).toBe(4.5);
    });

    it('should search places with location', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const results = await provider.placeSearch({ ll: [-74.006, 40.7128] });

      expect(results).toHaveLength(1);
      expect(fetch).toHaveBeenCalled();
    });

    it('should include optional parameters in request', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.placeSearch({
        query: 'pizza',
        ll: [-74.006, 40.7128],
        radius: 1000,
        types: ['restaurant'],
        limit: 20,
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('input')).toBe('pizza');
      // When query is provided, location is passed as locationbias
      expect(url.searchParams.get('locationbias')).toBe('point:40.7128,-74.006');
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

    it('should transform response to PlaceSearchResult format', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const results = await provider.placeSearch({ query: 'coffee' });

      expect(results[0]).toMatchObject({
        id: 'test-place-123',
        name: 'Test Coffee Shop',
        address: '123 Main St, New York, NY 10001',
        location: [-74.006, 40.7128],
        categories: ['cafe', 'establishment'],
        rating: 4.5,
        priceLevel: 2,
        hours: {
          openNow: true,
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
          json: () => Promise.resolve({ candidates: [], status: 'OK' }),
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
        ok: true,
        json: () =>
          Promise.resolve({
            status: 'INVALID_REQUEST',
            error_message: 'Invalid parameter',
          }),
      });

      await expect(provider.placeSearch({ query: 'coffee' })).rejects.toThrow(
        'Google Places API error: INVALID_REQUEST'
      );
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ candidates: [], status: 'OK' }),
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
        json: () => Promise.resolve({ candidates: [], status: 'OK' }),
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
      registerAPIProvider('google-places', provider);
      await initAPIProvider('google-places', { apiKey: 'test-key' });

      const foundProvider = getProviderForCapability('placeSearch');
      expect(foundProvider?.getName()).toBe('google-places');
    });
  });
});
