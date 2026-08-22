/**
 * Tests for MapTiler API Provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  _resetRegistries,
} from '../src/providers/registry';
import { MapTilerAPIProvider } from '../src/providers/maptiler-provider';

describe('MapTilerAPIProvider', () => {
  let provider: MapTilerAPIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    provider = new MapTilerAPIProvider();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('maptiler');
    });

    it('should have geocoding capability', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('geocoding');
      expect(capabilities.length).toBe(1);
    });

    it('should initialize with API key', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });
      // No error thrown means success
    });

    it('should warn when no API key provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      expect(consoleSpy).toHaveBeenCalledWith(
        '[gk-api-maptiler]  No API key provided. API calls will not work.'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('geocode validation', () => {
    it('should throw error when not initialized with API key', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      consoleSpy.mockRestore();
      await expect(provider.geocode({ query: 'New York' })).rejects.toThrow(
        'MapTiler API Provider: No API key configured.'
      );
    });

    it('should throw error when query is empty', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(provider.geocode({ query: '' })).rejects.toThrow(
        'MapTiler API Provider: Query string is required for geocoding'
      );
    });

    it('should throw error when query is not provided', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(provider.geocode({ query: undefined as any })).rejects.toThrow(
        'MapTiler API Provider: Query string is required for geocoding'
      );
    });
  });

  describe('geocode with mocked fetch', () => {
    const mockResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-74.006, 40.7128],
          },
          properties: {
            name: 'New York, NY, USA',
            place_name: 'New York, NY, USA',
            center: [-74.006, 40.7128],
            place_type: ['place'],
            relevance: 0.99,
          },
        },
      ],
    };

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);
    });

    it('should geocode query successfully', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const result = await provider.geocode({ query: 'New York' });

      expect(result).toBeDefined();
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(result.features[0].geometry.coordinates).toEqual([-74.006, 40.7128]);
      expect(fetch).toHaveBeenCalled();
    });

    it('should include query in URL', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.geocode({ query: 'San Francisco' });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.pathname).toContain('San%20Francisco');
    });

    it('should include API key in query params', async () => {
      await provider.initialize({ apiKey: 'my-secret-key' });

      await provider.geocode({ query: 'New York' });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('key')).toBe('my-secret-key');
    });

    it('should include limit parameter', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.geocode({ query: 'New York', limit: 10 });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('limit')).toBe('10');
    });

    it('should include proximity parameter', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.geocode({
        query: 'Springfield',
        proximity: [-74.006, 40.7128],
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('proximity')).toBe('-74.006,40.7128');
    });

    it('should include bbox parameter', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.geocode({
        query: 'New York',
        bbox: [-74.1, 40.7, -73.9, 40.8],
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('bbox')).toBe('-74.1,40.7,-73.9,40.8');
    });

    it('should use cache for repeated requests', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const options = { query: 'New York' };

      // First call
      await provider.geocode(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call with same options - should hit cache
      await provider.geocode(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Different query - should fetch again
      await provider.geocode({ query: 'Los Angeles' });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
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
          json: () =>
            Promise.resolve({
              type: 'FeatureCollection',
              features: [],
            }),
        });
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = provider.geocode({ query: 'New York' });

      // Advance timers to process all retries
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result.features).toEqual([]);
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

      // Store the error to check later - don't re-throw to avoid unhandled rejection
      let thrownError: Error | null = null;
      const promise = provider.geocode({ query: 'New York' }).catch((err) => {
        thrownError = err;
      });

      // Advance timers to process all retries
      await vi.runAllTimersAsync();
      await promise;

      expect(thrownError).not.toBeNull();
      expect(thrownError!.message).toContain('Too Many Requests (max retries exceeded)');
      expect(fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
      consoleSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid query' }),
      });

      await expect(provider.geocode({ query: 'New York' })).rejects.toThrow(
        'MapTiler API error: 400 Bad Request'
      );
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });

      // Initial call
      await provider.geocode({ query: 'New York' });

      let stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Cached call
      await provider.geocode({ query: 'New York' });

      stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should clear cache', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });

      await provider.geocode({ query: 'New York' });

      let stats = provider.getCacheStats();
      expect(stats.size).toBe(1);

      provider.clearCache();

      stats = provider.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('reverseGeocode validation', () => {
    it('should throw error when not initialized with API key', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      consoleSpy.mockRestore();
      await expect(provider.reverseGeocode({ lat: 40.7128, lng: -74.006 })).rejects.toThrow(
        'MapTiler API Provider: No API key configured.'
      );
    });

    it('should throw error when lat is invalid', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(provider.reverseGeocode({ lat: NaN, lng: -74.006 })).rejects.toThrow(
        'MapTiler API Provider: Valid lat/lng coordinates are required'
      );
    });

    it('should throw error when lng is invalid', async () => {
      await provider.initialize({ apiKey: 'test-key' });
      await expect(
        provider.reverseGeocode({ lat: 40.7128, lng: undefined as any })
      ).rejects.toThrow('MapTiler API Provider: Valid lat/lng coordinates are required');
    });
  });

  describe('reverseGeocode with mocked fetch', () => {
    const mockReverseResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [-74.006, 40.7128],
          },
          place_type: ['postal_code'],
          text: '10001',
          place_name: '10001, New York, NY, USA',
          context: [
            { id: 'municipality.123', text: 'New York' },
            { id: 'region.456', text: 'New York' },
            { id: 'country.789', text: 'United States', short_code: 'us' },
          ],
        },
      ],
    };

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockReverseResponse),
      } as Response);
    });

    it('should reverse geocode coordinates successfully', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const result = await provider.reverseGeocode({ lat: 40.7128, lng: -74.006 });

      expect(result).toBeDefined();
      expect(result?.postcode).toBe('10001');
      expect(result?.city).toBe('New York');
      expect(result?.state).toBe('New York');
      expect(result?.countryCode).toBe('US');
      expect(result?.coordinates).toEqual([-74.006, 40.7128]);
      expect(fetch).toHaveBeenCalled();
    });

    it('should include coordinates in URL path', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.reverseGeocode({ lat: 40.7128, lng: -74.006 });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.pathname).toContain('-74.006,40.7128');
    });

    it('should include API key in query params', async () => {
      await provider.initialize({ apiKey: 'my-secret-key' });

      await provider.reverseGeocode({ lat: 40.7128, lng: -74.006 });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('key')).toBe('my-secret-key');
    });

    it('should map postcode type to postal_code', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      await provider.reverseGeocode({ lat: 40.7128, lng: -74.006, types: ['postcode'] });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.searchParams.get('types')).toBe('postal_code');
    });

    it('should use cache for repeated requests', async () => {
      await provider.initialize({ apiKey: 'test-api-key' });

      const options = { lat: 40.7128, lng: -74.006 };

      // First call
      await provider.reverseGeocode(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call with same options - should hit cache
      await provider.reverseGeocode(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Different coordinates - should fetch again
      await provider.reverseGeocode({ lat: 34.0522, lng: -118.2437 });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should return null when no features found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
      } as Response);

      await provider.initialize({ apiKey: 'test-api-key' });

      const result = await provider.reverseGeocode({ lat: 0, lng: 0 });
      expect(result).toBeNull();
    });
  });

  describe('reverseGeocode error handling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await provider.initialize({ apiKey: 'test-api-key' });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should handle 429 rate limiting', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () => Promise.resolve({}),
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const promise = provider.reverseGeocode({ lat: 40.7128, lng: -74.006 });
      promise.catch(() => {});
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('MapTiler API error: 429 - Too Many Requests');

      consoleSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () => Promise.resolve({ message: 'Invalid coordinates' }),
      });

      await expect(provider.reverseGeocode({ lat: 40.7128, lng: -74.006 })).rejects.toThrow(
        'MapTiler API error: 400 Bad Request'
      );
    });
  });

  describe('integration with registry', () => {
    it('should register and route geocoding capability', async () => {
      registerAPIProvider('maptiler', provider);
      await initAPIProvider('maptiler', { apiKey: 'test-key' });

      const foundProvider = getProviderForCapability('geocoding');
      expect(foundProvider?.getName()).toBe('maptiler');
    });
  });
});
