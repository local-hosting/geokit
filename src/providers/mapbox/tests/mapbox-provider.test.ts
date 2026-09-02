/**
 * Tests for Mapbox API Provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerService,
  initService,
  getServiceForCapability,
} from '@twinfile/geokit/service/registry';
import { MapboxService } from '../src/mapbox-service';
import { useCleanAPIRegistry } from './setup/registries.ts';
import { isochroneFeatureCollection } from '../../../core/tests/fixtures/geojson';
import { mockGlobalFetchJson } from '../../../core/tests/mocks/fetch';

describe('MapboxService', () => {
  let provider: MapboxService;

  useCleanAPIRegistry();

  beforeEach(() => {
    provider = new MapboxService();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('mapbox');
    });

    it('should have correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('isochrone');
      expect(capabilities).toContain('directions');
      expect(capabilities).toContain('geocoding');
    });

    it('should initialize with access token', async () => {
      await provider.initialize({ accessToken: 'test-token' });
      // No error thrown means success
    });

    it('should warn when no access token provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      expect(consoleSpy).toHaveBeenCalledWith(
        '[gk-api-mapbox]  No access token provided. API calls will not work.'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('fetchIsochrone validation', () => {
    it('should throw error when not initialized with access token', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await provider.initialize({});
      consoleSpy.mockRestore();
      await expect(
        provider.fetchIsochrone({
          lat: 40.7128,
          lng: -74.006,
          minutes: [15],
          mode: 'driving',
        })
      ).rejects.toThrow('Mapbox API Provider: No access token configured.');
    });

    it('should throw error when missing required parameters', async () => {
      await provider.initialize({ accessToken: 'test-token' });
      await expect(
        provider.fetchIsochrone({
          lat: 40.7128,
          lng: -74.006,
          minutes: [],
          mode: 'driving',
        })
      ).rejects.toThrow('Mapbox API Provider: Invalid isochrone parameters');
    });
  });

  describe('fetchIsochrone with mocked fetch', () => {
    const mockResponse = isochroneFeatureCollection();

    beforeEach(() => {
      mockGlobalFetchJson(mockResponse);
    });

    it('should fetch isochrone successfully', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      const result = await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

      expect(result).toBeDefined();
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      expect(fetch).toHaveBeenCalled();
    });

    it('should use cache for repeated requests', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      const options = {
        lat: 40.7128,
        lng: -74.006,
        minutes: [15] as number[],
        mode: 'driving' as const,
      };

      // First call
      await provider.fetchIsochrone(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Second call with same options - should hit cache
      await provider.fetchIsochrone(options);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Different minutes - should fetch again
      await provider.fetchIsochrone({ ...options, minutes: [30] });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple time contours', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      const multiResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[-74.006, 40.7128]]] },
            properties: { contour: 15 },
          },
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[-74.006, 40.7128]]] },
            properties: { contour: 30 },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(multiResponse),
      } as Response);

      const result = await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15, 30],
        mode: 'driving',
      });

      expect(result.features).toHaveLength(2);
    });

    it('should handle different travel modes', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'walking',
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.pathname).toContain('walking');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      // Reset fetch before each test to ensure test isolation
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
      });
      await provider.initialize({ accessToken: 'test-token' });
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

      const promise = provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

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

      const promise = provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

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
        json: () => Promise.resolve({ message: 'Invalid coordinates' }),
      });

      await expect(
        provider.fetchIsochrone({
          lat: 40.7128,
          lng: -74.006,
          minutes: [15],
          mode: 'driving',
        })
      ).rejects.toThrow('Mapbox API error: 400 Bad Request');
    });

    it('should handle network failures', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        provider.fetchIsochrone({
          lat: 40.7128,
          lng: -74.006,
          minutes: [15],
          mode: 'driving',
        })
      ).rejects.toThrow('Failed to fetch isochrone');
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });

      // Initial call
      await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

      let stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Cached call
      await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

      stats = provider.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should clear cache', async () => {
      await provider.initialize({ accessToken: 'test-token' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });

      await provider.fetchIsochrone({
        lat: 40.7128,
        lng: -74.006,
        minutes: [15],
        mode: 'driving',
      });

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
    it('should register and route isochrone capability', async () => {
      registerService('mapbox', provider);
      await initService('mapbox', { accessToken: 'test-token' });

      const foundProvider = getServiceForCapability('isochrone');
      expect(foundProvider?.getName()).toBe('mapbox');
    });

    it('should register and route directions capability', async () => {
      registerService('mapbox', provider);
      await initService('mapbox', { accessToken: 'test-token' });

      const foundProvider = getServiceForCapability('directions');
      expect(foundProvider?.getName()).toBe('mapbox');
    });
  });
});
