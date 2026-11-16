import { describe, it, expect } from 'vitest';
import { registerUIProvider, setUIProvider } from '../../../src/providers/registry';
import {
  registerService,
  initService,
  getServiceForCapability,
} from '@doppler-group/geokit/service/registry';
import type { Service, ServiceCapability } from '@doppler-group/geokit/service/types';
import type { BaseUIProvider } from '../../../src/providers/types';
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
      registerService('mock-api', apiProvider);

      await setUIProvider('mock-ui', { apiKey: 'ui-key' });
      await initService('mock-api', { accessToken: 'api-token' });

      const isoProvider = getServiceForCapability('isochrone');
      expect(isoProvider).toBe(apiProvider);
    });

    it('should route capabilities to correct API provider', async () => {
      const apiProvider = new MockAPIProvider(['isochrone', 'geocoding']);
      registerService('multi-cap', apiProvider);
      await initService('multi-cap');

      expect(getServiceForCapability('isochrone')).toBe(apiProvider);
      expect(getServiceForCapability('geocoding')).toBe(apiProvider);
    });

    it('should handle missing capabilities gracefully', () => {
      registerService('limited', new MockAPIProvider(['isochrone']));
      expect(getServiceForCapability('matrix')).toBeNull();
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
      registerService('api-test', apiProvider);
      await initService('api-test');

      const provider = getServiceForCapability('isochrone');
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
      class IsochroneProvider implements Service {
        getName() {
          return 'iso';
        }
        async initialize() {}
        getCapabilities(): ServiceCapability[] {
          return ['isochrone'];
        }
        async fetchIsochrone() {
          return { type: 'FeatureCollection' as const, features: [] };
        }
      }

      class GeocodeProvider implements Service {
        getName() {
          return 'geocode';
        }
        async initialize() {}
        getCapabilities(): ServiceCapability[] {
          return ['geocoding'];
        }
      }

      registerService('iso-provider', new IsochroneProvider());
      registerService('geocode-provider', new GeocodeProvider());

      await initService('iso-provider');
      await initService('geocode-provider');

      expect(getServiceForCapability('isochrone')?.getName()).toBe('iso');
      expect(getServiceForCapability('geocoding')?.getName()).toBe('geocode');
    });

    it('should prioritize first registered provider for overlapping capabilities', () => {
      class Provider1 implements Service {
        getName() {
          return 'provider1';
        }
        async initialize() {}
        getCapabilities(): ServiceCapability[] {
          return ['isochrone', 'geocoding'];
        }
      }

      class Provider2 implements Service {
        getName() {
          return 'provider2';
        }
        async initialize() {}
        getCapabilities(): ServiceCapability[] {
          return ['isochrone', 'directions'];
        }
      }

      registerService('p1', new Provider1());
      registerService('p2', new Provider2());

      expect(getServiceForCapability('isochrone')?.getName()).toBe('provider1');
      expect(getServiceForCapability('directions')?.getName()).toBe('provider2');
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
      expect(getServiceForCapability('matrix')).toBeNull();
    });
  });
});
