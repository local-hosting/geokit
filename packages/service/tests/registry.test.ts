/**
 * Tests for API Provider Registry
 */

import { describe, it, expect } from 'vitest';
import {
  registerService,
  initService,
  getServiceForCapability,
  getCapabilityRouter,
  registerCapabilityRouter,
  getService,
} from '../src/services/registry';
import { MockAPIProvider } from '../../core/tests/mocks/mock-api-provider';
import { createCompositeService } from '../src/services/composite-service';
import { useCleanAPIRegistry } from './setup/registries.ts';
import { NYC } from '../../core/tests/fixtures/locations';

describe('API Provider Registry', () => {
  useCleanAPIRegistry();

  describe('registerService', () => {
    it('should register a new API provider', () => {
      const provider = new MockAPIProvider(['isochrone']);
      expect(() => registerService('test-api', provider)).not.toThrow();
    });

    it('should allow registering multiple providers', () => {
      const provider1 = new MockAPIProvider(['isochrone']);
      const provider2 = new MockAPIProvider(['geocoding']);

      expect(() => registerService('provider1', provider1)).not.toThrow();
      expect(() => registerService('provider2', provider2)).not.toThrow();
    });

    it('should index capabilities automatically', () => {
      const provider = new MockAPIProvider(['isochrone', 'directions']);
      registerService('multi-cap', provider);

      const isoProvider = getServiceForCapability('isochrone');
      const dirProvider = getServiceForCapability('directions');

      expect(isoProvider?.getName()).toBe('mock-api');
      expect(dirProvider?.getName()).toBe('mock-api');
    });
  });

  describe('initService', () => {
    it('should initialize a registered provider', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerService('test', provider);

      const result = await initService('test', { accessToken: 'test-token' });
      expect(result).toBe(provider);
    });

    it('should throw if provider is not registered', async () => {
      await expect(initService('non-existent')).rejects.toThrow();
    });

    it('should initialize provider with config', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerService('test', provider);

      await initService('test', { accessToken: 'test-token' });
      expect(provider.getConfig()).toEqual({ accessToken: 'test-token' });
    });
  });

  describe('getServiceForCapability', () => {
    it('should return provider with requested capability', () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerService('iso-provider', provider);

      const result = getServiceForCapability('isochrone');
      expect(result?.getName()).toBe('mock-api');
    });

    it('should return null if no provider has capability', () => {
      const provider = new MockAPIProvider(['geocoding']);
      registerService('geocode-provider', provider);

      const result = getServiceForCapability('isochrone');
      expect(result).toBeNull();
    });

    it('should return first provider if multiple have capability', () => {
      const provider1 = new MockAPIProvider(['isochrone']);
      const provider2 = new MockAPIProvider(['isochrone']);

      registerService('provider1', provider1);
      registerService('provider2', provider2);

      const result = getServiceForCapability('isochrone');
      expect(result).toBe(provider1);
    });

    it('should handle multiple capabilities per provider', () => {
      const provider = new MockAPIProvider(['isochrone', 'directions', 'matrix']);
      registerService('multi-cap', provider);

      expect(getServiceForCapability('isochrone')?.getName()).toBe('mock-api');
      expect(getServiceForCapability('directions')?.getName()).toBe('mock-api');
      expect(getServiceForCapability('matrix')?.getName()).toBe('mock-api');
    });
  });

  describe('getService', () => {
    it('should return provider by name', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerService('test', provider);
      await initService('test');

      const result = getService('test');
      expect(result?.getName()).toBe('mock-api');
    });

    it('should return null if provider not found', () => {
      const result = getService('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('provider API methods', () => {
    it('should fetch isochrone after initialization', async () => {
      const provider = new MockAPIProvider(['isochrone']);
      registerService('test', provider);
      await initService('test', { accessToken: 'test-token' });

      const result = await provider.fetchIsochrone?.({
        lat: NYC.lat,
        lng: NYC.lng,
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
      registerService('cache-test', provider);
      await initService('cache-test');

      const options = { lat: NYC.lat, lng: NYC.lng, minutes: [15], mode: 'driving' as const };

      await provider.fetchIsochrone?.(options);
      expect(provider.getFetchCount()).toBe(1);

      await provider.fetchIsochrone?.(options);
      expect(provider.getFetchCount()).toBe(1);

      await provider.fetchIsochrone?.({ ...options, minutes: [30] });
      expect(provider.getFetchCount()).toBe(2);
    });
  });

  describe('capability routing scenarios', () => {
    it('should route different capabilities to different providers', async () => {
      const isoProvider = new MockAPIProvider(['isochrone']);
      const geocodeProvider = new MockAPIProvider(['geocoding']);

      registerService('iso', isoProvider);
      registerService('geocode', geocodeProvider);
      await initService('iso');
      await initService('geocode');

      const iso = getServiceForCapability('isochrone');
      const geocode = getServiceForCapability('geocoding');

      expect(iso).toBe(isoProvider);
      expect(geocode).toBe(geocodeProvider);
    });

    it('should handle provider with overlapping capabilities', () => {
      const provider1 = new MockAPIProvider(['isochrone', 'geocoding']);
      const provider2 = new MockAPIProvider(['geocoding', 'directions']);

      registerService('provider1', provider1);
      registerService('provider2', provider2);

      expect(getServiceForCapability('isochrone')).toBe(provider1);
      expect(getServiceForCapability('geocoding')).toBe(provider1);
      expect(getServiceForCapability('directions')).toBe(provider2);
    });
  });

  describe('registerCapabilityRouter', () => {
    it('should take precedence over indexed providers', () => {
      const indexed = new MockAPIProvider(['geocoding']);
      const primary = new MockAPIProvider(['geocoding']);
      const fallback = new MockAPIProvider(['geocoding']);

      registerService('indexed', indexed);
      registerCapabilityRouter(
        'geocoding',
        createCompositeService({
          name: 'composite:geocoding',
          chains: { geocoding: [primary, fallback] },
        })
      );

      expect(getServiceForCapability('geocoding')?.getName()).toBe('composite:geocoding');
      expect(getCapabilityRouter('geocoding')?.getName()).toBe('composite:geocoding');
    });
  });
});

import {
  clearServices,
  getServicesForCapability,
  getRegisteredServices,
  getSupportedCapabilities,
  isCapabilitySupported,
} from '../src/services/registry';

describe('registry introspection helpers', () => {
  useCleanAPIRegistry();

  it('lists providers, capabilities, and support checks', () => {
    const provider = new MockAPIProvider(['isochrone', 'matrix']);
    registerService('stats-provider', provider);

    expect(getRegisteredServices()).toContain('stats-provider');
    expect(getSupportedCapabilities()).toEqual(expect.arrayContaining(['isochrone', 'matrix']));
    expect(isCapabilitySupported('isochrone')).toBe(true);
    expect(isCapabilitySupported('geocoding')).toBe(false);
    expect(getServicesForCapability('matrix')).toHaveLength(1);
  });

  it('clears all providers and capability routers', () => {
    registerService('temp', new MockAPIProvider(['directions']));
    clearServices();
    expect(getRegisteredServices()).toEqual([]);
    expect(getServiceForCapability('directions')).toBeNull();
  });
});
