/**
 * Tests for API Provider Registry
 */

import { describe, it, expect } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  getCapabilityRouter,
  registerCapabilityRouter,
  getAPIProvider,
} from '../src/providers/registry';
import { MockAPIProvider } from '../../core/tests/mocks/mock-api-provider';
import { createCompositeAPIProvider } from '../src/providers/composite-provider';
import { useCleanAPIRegistry } from './setup/registries.ts';
import { NYC } from '../../core/tests/fixtures/locations';

describe('API Provider Registry', () => {
  useCleanAPIRegistry();

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
      registerAPIProvider('test', provider);

      await initAPIProvider('test', { accessToken: 'test-token' });
      expect(provider.getConfig()).toEqual({ accessToken: 'test-token' });
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
      registerAPIProvider('cache-test', provider);
      await initAPIProvider('cache-test');

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

      expect(getProviderForCapability('isochrone')).toBe(provider1);
      expect(getProviderForCapability('geocoding')).toBe(provider1);
      expect(getProviderForCapability('directions')).toBe(provider2);
    });
  });

  describe('registerCapabilityRouter', () => {
    it('should take precedence over indexed providers', () => {
      const indexed = new MockAPIProvider(['geocoding']);
      const primary = new MockAPIProvider(['geocoding']);
      const fallback = new MockAPIProvider(['geocoding']);

      registerAPIProvider('indexed', indexed);
      registerCapabilityRouter(
        'geocoding',
        createCompositeAPIProvider({
          name: 'composite:geocoding',
          chains: { geocoding: [primary, fallback] },
        })
      );

      expect(getProviderForCapability('geocoding')?.getName()).toBe('composite:geocoding');
      expect(getCapabilityRouter('geocoding')?.getName()).toBe('composite:geocoding');
    });
  });
});

import {
  clearAPIProviders,
  getProvidersForCapability,
  getRegisteredAPIProviders,
  getSupportedCapabilities,
  isCapabilitySupported,
} from '../src/providers/registry';

describe('registry introspection helpers', () => {
  useCleanAPIRegistry();

  it('lists providers, capabilities, and support checks', () => {
    const provider = new MockAPIProvider(['isochrone', 'matrix']);
    registerAPIProvider('stats-provider', provider);

    expect(getRegisteredAPIProviders()).toContain('stats-provider');
    expect(getSupportedCapabilities()).toEqual(expect.arrayContaining(['isochrone', 'matrix']));
    expect(isCapabilitySupported('isochrone')).toBe(true);
    expect(isCapabilitySupported('geocoding')).toBe(false);
    expect(getProvidersForCapability('matrix')).toHaveLength(1);
  });

  it('clears all providers and capability routers', () => {
    registerAPIProvider('temp', new MockAPIProvider(['directions']));
    clearAPIProviders();
    expect(getRegisteredAPIProviders()).toEqual([]);
    expect(getProviderForCapability('directions')).toBeNull();
  });
});
