/**
 * Tests for Census Demographics API Provider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerAPIProvider,
  initAPIProvider,
  getProviderForCapability,
  _resetRegistries,
} from '../../src/api/providers/registry';
import { CensusDemographicsProvider } from '../../src/api/providers/census-demographics-provider';
import { clearZipCache } from '../../src/utils/demographics/zipcode';

describe('CensusDemographicsProvider', () => {
  let provider: CensusDemographicsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    clearZipCache();
    provider = new CensusDemographicsProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(provider.getName()).toBe('census-demographics');
    });

    it('should have demographics capability', () => {
      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('demographics');
      expect(capabilities.length).toBe(1);
    });

    it('should initialize without API key (Census API is free)', async () => {
      await provider.initialize({});
      // No error thrown means success
    });

    it('should initialize with empty config', async () => {
      await provider.initialize({});
      // Census API doesn't require API key
    });
  });

  describe('fetchDemographics validation', () => {
    // Note: lat/lng to ZIP geocoding now uses Mapbox provider via registry
    it.skip('should geocode lat/lng to ZIP and fetch demographics', async () => {
      // Requires provider registry mocking
    });

    it('should return null for polygon queries without center lat/lng', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await provider.fetchDemographics({
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [-74.006, 40.7128],
              [-74.005, 40.7128],
              [-74.005, 40.713],
              [-74.006, 40.713],
              [-74.006, 40.7128],
            ],
          ],
        },
      });
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return null when no options provided', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await provider.fetchDemographics({});
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('fetchDemographics with mocked fetch', () => {
    const mockResponse = [
      ['NAME', 'B01001_001E', 'B19013_001E', 'B25064_001E', 'zip code tabulation area'],
      ['ZCTA5 10001', '12345', '75000', '2500', '10001'],
    ];

    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockResponse)),
      } as Response);
    });

    it('should fetch demographics with zipcode', async () => {
      await provider.initialize({});

      const result = await provider.fetchDemographics({
        zipcode: '10001',
      });

      expect(result).toBeDefined();
      expect(result?.totalPopulation).toBe(12345);
      expect(result?.medianHouseholdIncome).toBe(75000);
      expect(result?.medianRent).toBe(2500);
      expect(fetch).toHaveBeenCalled();
    });

    it('should include zipcode in API URL', async () => {
      await provider.initialize({});

      await provider.fetchDemographics({
        zipcode: '10001',
      });

      const fetchCall = (fetch as any).mock.calls[0];
      const url = new URL(fetchCall[0]);
      expect(url.pathname).toContain('acs5');
      expect(url.search).toContain('10001');
    });

    it('should handle Census API response format', async () => {
      await provider.initialize({});

      const result = await provider.fetchDemographics({
        zipcode: '10001',
      });

      expect(result).toMatchObject({
        totalPopulation: 12345,
        medianHouseholdIncome: 75000,
        medianRent: 2500,
      });
    });

    it('should handle missing data gracefully', async () => {
      const responseWithNulls = [
        [
          'NAME',
          'B01001_001E',
          'B19013_001E',
          'B25077_001E',
          'B25064_001E',
          'zip code tabulation area',
        ],
        ['ZCTA5 10001', null, '-', '', '2500', '10001'],
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(responseWithNulls)),
      } as Response);

      const result = await provider.fetchDemographics({
        zipcode: '10001',
      });

      expect(result?.totalPopulation).toBeUndefined();
      expect(result?.medianHouseholdIncome).toBeUndefined();
      expect(result?.medianHomeValue).toBeUndefined();
      expect(result?.medianRent).toBe(2500);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await provider.initialize({});
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      // Census provider silently skips failed responses and returns null
      const result = await provider.fetchDemographics({
        zipcode: 'invalid',
      });

      expect(result).toBeNull();
    });

    it('should handle invalid response format', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ error: 'Invalid request' })),
      });

      const result = await provider.fetchDemographics({
        zipcode: '10001',
      });

      expect(result).toBeNull();
    });

    it('should handle network failures gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await provider.fetchDemographics({
        zipcode: '10001',
      });

      // Census provider catches errors and returns null
      expect(result).toBeNull();
      // Note: Network errors at the fetch level still trigger the outer try/catch warning
      consoleSpy.mockRestore();
    });
  });

  describe('polygon queries', () => {
    // Note: Polygon queries now use Mapbox provider via getZipForPoint
    // which uses the provider registry. These tests require full provider mocking.
    it.skip('should find ZIPs in polygon and aggregate demographics', async () => {
      // Requires provider registry mocking
    });

    it.skip('should return null when no ZIPs found in polygon', async () => {
      // Requires provider registry mocking
    });
  });

  describe('integration with registry', () => {
    it('should register and route demographics capability', async () => {
      registerAPIProvider('census-demographics', provider);
      await initAPIProvider('census-demographics', {});

      const foundProvider = getProviderForCapability('demographics');
      expect(foundProvider?.getName()).toBe('census-demographics');
    });
  });
});
