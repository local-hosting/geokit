import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  registerUIProvider,
  setUIProvider,
  _resetRegistries as _resetUIRegistries,
} from '../../src/ui/providers/registry';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  _resetRegistries as _resetAPIRegistries,
} from '../../src/api/providers/registry';
import type { BaseUIProvider, MapProviderConfig } from '../../src/ui/providers/types';
import type { BaseAPIProvider, APICapability } from '../../src/api/providers/types';

// Mock UI Provider
class MockUIProvider implements BaseUIProvider {
  getName(): string {
    return 'mock-ui';
  }

  async initialize(_config: MapProviderConfig): Promise<void> {}

  async createMap(_container: HTMLElement, _options: any): Promise<any> {
    return {
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getLayer: vi.fn(),
      getSource: vi.fn(() => ({ _data: { type: 'FeatureCollection', features: [] } })),
      getCanvas: vi.fn(() => ({ style: { cursor: '' } })),
    };
  }

  createControl(_type: string, _options: any): any {
    return { onAdd: vi.fn(), onRemove: vi.fn() };
  }

  createMarker(_options: any): any {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    };
  }

  createPopup(_options: any): any {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    };
  }

  getSDK(): any {
    return {};
  }
}

// Mock API Provider with caching
class MockAPIProvider implements BaseAPIProvider {
  private cache = new Map<string, any>();
  private fetchCount = 0;
  private initialized = false;

  getName(): string {
    return 'mock-api';
  }

  async initialize(_config: MapProviderConfig): Promise<void> {
    this.initialized = true;
  }

  getCapabilities(): APICapability[] {
    return ['isochrone', 'geocoding'];
  }

  async fetchIsochrone(options: any): Promise<GeoJSON.FeatureCollection> {
    // Create cache key
    const cacheKey = `${options.lat},${options.lng},${options.time},${options.mode}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey); // Return from cache without incrementing
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
                [options.lng, options.lat],
                [options.lng + 0.01, options.lat],
                [options.lng + 0.01, options.lat + 0.01],
                [options.lng, options.lat + 0.01],
                [options.lng, options.lat],
              ],
            ],
          },
          properties: {
            time: options.time,
            mode: options.mode,
          },
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

  clearCache(): void {
    this.cache.clear();
  }
}

describe('UI Integration Tests', () => {
  let dom: JSDOM;

  beforeEach(async () => {
    // Setup JSDOM
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document as any;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement as any;
    global.customElements = dom.window.customElements as any;
    global.CustomEvent = dom.window.CustomEvent as any;

    vi.clearAllMocks();
    _resetUIRegistries();
    _resetAPIRegistries();
  });

  describe('Provider Integration', () => {
    it('should initialize both UI and API providers independently', async () => {
      const uiProvider = new MockUIProvider();
      const apiProvider = new MockAPIProvider();

      registerUIProvider('mock-ui', uiProvider);
      registerAPIProvider('mock-api', apiProvider);

      await setUIProvider('mock-ui', { apiKey: 'ui-key' });
      await initAPIProvider('mock-api', { accessToken: 'api-token' });

      // Both should be accessible
      const isoProvider = getProviderForCapability('isochrone');
      expect(isoProvider).toBe(apiProvider);
    });

    it('should route capabilities to correct API provider', async () => {
      const apiProvider = new MockAPIProvider();
      registerAPIProvider('multi-cap', apiProvider);
      await initAPIProvider('multi-cap');

      const isoProvider = getProviderForCapability('isochrone');
      const geocodeProvider = getProviderForCapability('geocoding');

      expect(isoProvider).toBe(apiProvider);
      expect(geocodeProvider).toBe(apiProvider);
    });

    it('should handle missing capabilities gracefully', () => {
      const apiProvider = new MockAPIProvider();
      registerAPIProvider('limited', apiProvider);

      const matrixProvider = getProviderForCapability('matrix');
      expect(matrixProvider).toBeNull();
    });
  });

  describe('Isochrone Caching', () => {
    it('should demonstrate caching capability within provider instance', async () => {
      const apiProvider = new MockAPIProvider();

      const options = {
        lat: 40.7128,
        lng: -74.006,
        time: 15,
        mode: 'driving',
      };

      // First fetch - should increment fetchCount
      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1);

      // Second fetch with same options (should use cache, fetchCount stays same)
      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1); // Cache hit!
    });

    it('should create new cache entry for different parameters', async () => {
      const apiProvider = new MockAPIProvider();

      // Fetch with different parameters
      await apiProvider.fetchIsochrone?.({ lat: 40.7128, lng: -74.006, time: 15, mode: 'driving' });
      await apiProvider.fetchIsochrone?.({ lat: 40.7128, lng: -74.006, time: 30, mode: 'driving' });
      await apiProvider.fetchIsochrone?.({
        lat: 41.8781,
        lng: -87.6298,
        time: 15,
        mode: 'driving',
      });

      // Should have made 3 fetches (different cache keys)
      expect(apiProvider.getFetchCount()).toBe(3);
    });

    it('should clear cache when requested', async () => {
      const apiProvider = new MockAPIProvider();

      const options = { lat: 40.7128, lng: -74.006, time: 15, mode: 'driving' };

      // Initial fetch
      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1);

      // Clear cache
      apiProvider.clearCache();

      // Fetch again (should not use cache)
      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(2);
    });
  });

  describe('Component-Provider Interaction', () => {
    it('should allow components to request UI provider capabilities', async () => {
      const uiProvider = new MockUIProvider();
      registerUIProvider('ui-test', uiProvider);
      await setUIProvider('ui-test');

      const container = document.createElement('div');
      const map = await uiProvider.createMap(container, { zoom: 10 });

      expect(map).toBeDefined();
      expect(map.addSource).toBeDefined();
    });

    it('should allow components to request API provider capabilities', async () => {
      const apiProvider = new MockAPIProvider();
      registerAPIProvider('api-test', apiProvider);
      await initAPIProvider('api-test');

      const provider = getProviderForCapability('isochrone');
      expect(provider).toBeDefined();

      const result = await provider?.fetchIsochrone?.({
        lat: 40.7128,
        lng: -74.006,
        time: 15,
        mode: 'driving',
      });

      expect(result).toBeDefined();
      expect(result?.type).toBe('FeatureCollection');
    });
  });

  describe('Multi-Provider Scenarios', () => {
    it('should support multiple API providers with different capabilities', async () => {
      class IsochroneProvider implements BaseAPIProvider {
        getName() {
          return 'iso';
        }
        async initialize() {}
        getCapabilities(): APICapability[] {
          return ['isochrone'];
        }
        async fetchIsochrone() {
          return { type: 'FeatureCollection' as const, features: [] };
        }
      }

      class GeocodeProvider implements BaseAPIProvider {
        getName() {
          return 'geocode';
        }
        async initialize() {}
        getCapabilities(): APICapability[] {
          return ['geocoding'];
        }
      }

      registerAPIProvider('iso-provider', new IsochroneProvider());
      registerAPIProvider('geocode-provider', new GeocodeProvider());

      await initAPIProvider('iso-provider');
      await initAPIProvider('geocode-provider');

      const isoProvider = getProviderForCapability('isochrone');
      const geocodeProvider = getProviderForCapability('geocoding');

      expect(isoProvider?.getName()).toBe('iso');
      expect(geocodeProvider?.getName()).toBe('geocode');
    });

    it('should prioritize first registered provider for overlapping capabilities', async () => {
      class Provider1 implements BaseAPIProvider {
        getName() {
          return 'provider1';
        }
        async initialize() {}
        getCapabilities(): APICapability[] {
          return ['isochrone', 'geocoding'];
        }
      }

      class Provider2 implements BaseAPIProvider {
        getName() {
          return 'provider2';
        }
        async initialize() {}
        getCapabilities(): APICapability[] {
          return ['isochrone', 'directions'];
        }
      }

      registerAPIProvider('p1', new Provider1());
      registerAPIProvider('p2', new Provider2());

      // For isochrone, first provider (p1) should be used
      const isoProvider = getProviderForCapability('isochrone');
      expect(isoProvider?.getName()).toBe('provider1');

      // For directions, only p2 has it
      const dirProvider = getProviderForCapability('directions');
      expect(dirProvider?.getName()).toBe('provider2');
    });
  });

  describe('Error Handling', () => {
    it('should handle provider initialization failures gracefully', async () => {
      class FailingProvider implements BaseUIProvider {
        getName() {
          return 'failing';
        }
        async initialize() {
          throw new Error('Initialization failed');
        }
        async createMap() {
          return null;
        }
        createControl() {
          return null;
        }
        createMarker() {
          return null;
        }
        createPopup() {
          return null;
        }
        getSDK() {
          return null;
        }
      }

      registerUIProvider('failing', new FailingProvider());

      await expect(setUIProvider('failing')).rejects.toThrow('Initialization failed');
    });

    it('should handle missing API provider for capability', () => {
      const provider = getProviderForCapability('matrix');
      expect(provider).toBeNull();
    });
  });
});
