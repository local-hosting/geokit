import { describe, it, expect } from 'vitest';
import { registerUIProvider, setUIProvider } from '../../../src/ui/providers/registry';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
} from '@geokit/api/registry';
import type { BaseAPIProvider, APICapability } from '@geokit/api/types';
import type { BaseUIProvider } from '../../../src/ui/providers/types';
import { MockAPIProvider } from '../../mocks/mock-api-provider';
import { MockUIProvider } from '../../mocks/mock-ui-provider';
import { useCleanProviderRegistries } from '../../setup/registries';
import { CHICAGO, NYC } from '../../fixtures/locations';

describe('Provider registry integration', () => {
  useCleanProviderRegistries();

  describe('Provider Integration', () => {
    it('should initialize both UI and API providers independently', async () => {
      const uiProvider = new MockUIProvider();
      const apiProvider = new MockAPIProvider();

      registerUIProvider('mock-ui', uiProvider);
      registerAPIProvider('mock-api', apiProvider);

      await setUIProvider('mock-ui', { apiKey: 'ui-key' });
      await initAPIProvider('mock-api', { accessToken: 'api-token' });

      const isoProvider = getProviderForCapability('isochrone');
      expect(isoProvider).toBe(apiProvider);
    });

    it('should route capabilities to correct API provider', async () => {
      const apiProvider = new MockAPIProvider(['isochrone', 'geocoding']);
      registerAPIProvider('multi-cap', apiProvider);
      await initAPIProvider('multi-cap');

      expect(getProviderForCapability('isochrone')).toBe(apiProvider);
      expect(getProviderForCapability('geocoding')).toBe(apiProvider);
    });

    it('should handle missing capabilities gracefully', () => {
      registerAPIProvider('limited', new MockAPIProvider(['isochrone']));
      expect(getProviderForCapability('matrix')).toBeNull();
    });
  });

  describe('Isochrone Caching', () => {
    it('should demonstrate caching capability within provider instance', async () => {
      const apiProvider = new MockAPIProvider();
      await apiProvider.initialize({});
      const options = { lat: NYC.lat, lng: NYC.lng, time: 15, mode: 'driving' };

      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1);

      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1);
    });

    it('should create new cache entry for different parameters', async () => {
      const apiProvider = new MockAPIProvider();
      await apiProvider.initialize({});

      await apiProvider.fetchIsochrone?.({ lat: NYC.lat, lng: NYC.lng, time: 15, mode: 'driving' });
      await apiProvider.fetchIsochrone?.({ lat: NYC.lat, lng: NYC.lng, time: 30, mode: 'driving' });
      await apiProvider.fetchIsochrone?.({
        lat: CHICAGO.lat,
        lng: CHICAGO.lng,
        time: 15,
        mode: 'driving',
      });

      expect(apiProvider.getFetchCount()).toBe(3);
    });

    it('should clear cache when requested', async () => {
      const apiProvider = new MockAPIProvider();
      await apiProvider.initialize({});
      const options = { lat: NYC.lat, lng: NYC.lng, time: 15, mode: 'driving' };

      await apiProvider.fetchIsochrone?.(options);
      expect(apiProvider.getFetchCount()).toBe(1);

      apiProvider.clearCache();

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
      expect((map as { addSource: unknown }).addSource).toBeDefined();
    });

    it('should allow components to request API provider capabilities', async () => {
      const apiProvider = new MockAPIProvider();
      registerAPIProvider('api-test', apiProvider);
      await initAPIProvider('api-test');

      const provider = getProviderForCapability('isochrone');
      const result = await provider?.fetchIsochrone?.({
        lat: NYC.lat,
        lng: NYC.lng,
        time: 15,
        mode: 'driving',
      });

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

      expect(getProviderForCapability('isochrone')?.getName()).toBe('iso');
      expect(getProviderForCapability('geocoding')?.getName()).toBe('geocode');
    });

    it('should prioritize first registered provider for overlapping capabilities', () => {
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

      expect(getProviderForCapability('isochrone')?.getName()).toBe('provider1');
      expect(getProviderForCapability('directions')?.getName()).toBe('provider2');
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
      expect(getProviderForCapability('matrix')).toBeNull();
    });
  });
});
