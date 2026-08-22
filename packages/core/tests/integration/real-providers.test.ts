/**
 * Integration tests for real provider implementations
 *
 * These tests use actual API keys and make real network requests.
 * They are skipped in CI if environment variables are not set.
 *
 * **IMPORTANT**: The Mapbox token in .env needs to have Isochrone API access.
 * If you see 403 Forbidden errors, you need to:
 * 1. Create a new token at https://account.mapbox.com/access-tokens/
 * 2. Enable "Isochrone API" scope
 * 3. Update MAPBOX_TOKEN in .env
 *
 * To run locally:
 *   yarn test:integration
 *
 * Or run all tests including integration:
 *   yarn test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapTilerUIProvider } from '../../src/ui/providers/maptiler-provider';
import { MapboxUIProvider } from '../../src/ui/providers/mapbox-provider';
import { MapboxAPIProvider } from '../../src/api/providers/mapbox-provider';
import type { IsochroneOptions } from '../../src/api/providers/types';

// Load API keys from environment
// In browser tests, use import.meta.env; in node/jsdom, use process.env
const MAPTILER_KEY =
  typeof process !== 'undefined'
    ? process.env.MAPTILER_API_KEY || process.env.MAPTILER_KEY
    : import.meta.env?.MAPTILER_API_KEY || import.meta.env?.MAPTILER_KEY;
const MAPBOX_TOKEN =
  typeof process !== 'undefined'
    ? process.env.MAPBOX_ACCESS_TOKEN || process.env.MAPBOX_TOKEN
    : import.meta.env?.MAPBOX_ACCESS_TOKEN || import.meta.env?.MAPBOX_TOKEN;

// Check if we're in a real browser environment (not jsdom)
// Real browsers have WebGL support, jsdom does not
const isBrowser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  navigator.userAgent &&
  !navigator.userAgent.includes('jsdom') &&
  typeof WebGLRenderingContext !== 'undefined';

describe('Real Provider Integration Tests', () => {
  describe('MapTiler UI Provider', () => {
    // UI provider tests require a real browser with WebGL support
    // jsdom doesn't support URL.createObjectURL or WebGL
    // Run these tests with: yarn test:browser:integration
    it.skipIf(!MAPTILER_KEY || !isBrowser)('should initialize with real API key', async () => {
      const provider = new MapTilerUIProvider();

      await provider.initialize({ apiKey: MAPTILER_KEY! });

      const sdk = provider.getSDK();
      expect(sdk).toBeDefined();
      expect(sdk.Map).toBeDefined();
      expect(sdk.config).toBeDefined();
    });

    it.skipIf(!MAPTILER_KEY || !isBrowser)('should create a real map instance', async () => {
      const provider = new MapTilerUIProvider();
      await provider.initialize({ apiKey: MAPTILER_KEY! });

      const container = document.createElement('div');
      container.style.width = '400px';
      container.style.height = '300px';
      document.body.appendChild(container);

      const map = await provider.createMap(container, {
        center: [-74.006, 40.7128], // NYC
        zoom: 10,
        style: 'streets-v2',
      });

      expect(map).toBeDefined();
      expect(map.getZoom()).toBeCloseTo(10, 1);
      expect(map.getCenter()).toBeDefined();

      // Cleanup
      map.remove();
      document.body.removeChild(container);
    });

    it.skipIf(!MAPTILER_KEY || !isBrowser)('should create controls', async () => {
      const provider = new MapTilerUIProvider();
      await provider.initialize({ apiKey: MAPTILER_KEY! });

      const navControl = provider.createControl('navigation', {});
      expect(navControl).toBeDefined();

      const scaleControl = provider.createControl('scale', { unit: 'metric' });
      expect(scaleControl).toBeDefined();
    });

    it.skipIf(!MAPTILER_KEY || !isBrowser)('should create marker', async () => {
      const provider = new MapTilerUIProvider();
      await provider.initialize({ apiKey: MAPTILER_KEY! });

      const marker = provider.createMarker({
        color: '#FF0000',
      });

      // MapTiler markers need setLngLat() called after creation
      marker.setLngLat([-74.006, 40.7128]);

      expect(marker).toBeDefined();
      expect(marker.getLngLat()).toBeDefined();
    });

    it.skipIf(!MAPTILER_KEY || !isBrowser)('should create popup', async () => {
      const provider = new MapTilerUIProvider();
      await provider.initialize({ apiKey: MAPTILER_KEY! });

      const popup = provider.createPopup({
        html: '<div>Test Popup</div>',
      });

      // MapTiler popups need setLngLat() called after creation
      popup.setLngLat([-74.006, 40.7128]);

      expect(popup).toBeDefined();
      expect(popup.getLngLat()).toBeDefined();
    });
  });

  describe('Mapbox UI Provider', () => {
    // UI provider tests require a real browser with WebGL support
    // jsdom doesn't support accessToken property redefinition
    // Run these tests with: yarn test:browser:integration
    it.skipIf(!MAPBOX_TOKEN || !isBrowser)('should initialize with real access token', async () => {
      const provider = new MapboxUIProvider();

      await provider.initialize({ accessToken: MAPBOX_TOKEN! });

      const sdk = provider.getSDK();
      expect(sdk).toBeDefined();
      expect(sdk.Map).toBeDefined();
      expect(sdk.accessToken).toBe(MAPBOX_TOKEN);
    });

    it.skipIf(!MAPBOX_TOKEN || !isBrowser)('should create a real map instance', async () => {
      const provider = new MapboxUIProvider();
      await provider.initialize({ accessToken: MAPBOX_TOKEN! });

      const container = document.createElement('div');
      container.style.width = '400px';
      container.style.height = '300px';
      document.body.appendChild(container);

      const map = await provider.createMap(container, {
        center: [-122.4194, 37.7749], // SF
        zoom: 12,
        style: 'mapbox://styles/mapbox/streets-v12',
      });

      expect(map).toBeDefined();
      expect(map.getZoom()).toBeCloseTo(12, 1);
      expect(map.getCenter()).toBeDefined();

      // Cleanup
      map.remove();
      document.body.removeChild(container);
    });
  });

  describe('Mapbox API Provider', () => {
    let provider: MapboxAPIProvider;

    beforeEach(() => {
      provider = new MapboxAPIProvider();
    });

    it.skipIf(!MAPBOX_TOKEN)('should initialize with real access token', async () => {
      await provider.initialize({ accessToken: MAPBOX_TOKEN! });

      const capabilities = provider.getCapabilities();
      expect(capabilities).toContain('isochrone');
      expect(capabilities).toContain('directions');
    });

    it.skipIf(!MAPBOX_TOKEN)(
      'should fetch real isochrone from Mapbox API',
      async () => {
        await provider.initialize({ accessToken: MAPBOX_TOKEN! });

        const options: IsochroneOptions = {
          lng: -122.4194,
          lat: 37.7749, // San Francisco
          mode: 'driving',
          minutes: [10, 20],
        };

        try {
          const result = await provider.fetchIsochrone(options);

          // Validate GeoJSON structure
          expect(result).toBeDefined();
          expect(result.type).toBe('FeatureCollection');
          expect(result.features).toBeDefined();
          expect(result.features.length).toBeGreaterThan(0);

          // Validate feature properties
          const feature = result.features[0];
          expect(feature.type).toBe('Feature');
          expect(feature.geometry).toBeDefined();
          expect(feature.geometry.type).toBe('Polygon');
          expect(feature.geometry.coordinates).toBeDefined();
          expect(feature.properties).toBeDefined();

          // Validate contour values match requested minutes
          const contours = result.features.map((f) => f.properties?.contour);
          expect(contours).toContain(10);
          expect(contours).toContain(20);
        } catch (error) {
          // Skip test if network is unavailable (sandbox environment)
          if (error instanceof Error && error.message.includes('Network request failed')) {
            console.warn('Skipping test: Network unavailable');
            return;
          }
          throw error;
        }
      },
      10000
    ); // 10s timeout for network request

    it.skipIf(!MAPBOX_TOKEN)(
      'should cache isochrone responses',
      async () => {
        await provider.initialize({ accessToken: MAPBOX_TOKEN! });

        const options: IsochroneOptions = {
          lng: -73.9857,
          lat: 40.7484, // NYC (Empire State)
          mode: 'walking',
          minutes: [15],
        };

        try {
          // First call - should hit API
          const start1 = Date.now();
          const result1 = await provider.fetchIsochrone(options);
          const duration1 = Date.now() - start1;

          // Second call - should hit cache (much faster)
          const start2 = Date.now();
          const result2 = await provider.fetchIsochrone(options);
          const duration2 = Date.now() - start2;

          // Validate both results are identical
          expect(result2).toEqual(result1);

          // Cache hit should be significantly faster (< 10ms vs > 500ms)
          expect(duration2).toBeLessThan(50);
          console.log(`First fetch: ${duration1}ms, Cached fetch: ${duration2}ms`);
        } catch (error) {
          // Skip test if network is unavailable (sandbox environment)
          if (error instanceof Error && error.message.includes('Network request failed')) {
            console.warn('Skipping test: Network unavailable');
            return;
          }
          throw error;
        }
      },
      10000
    );

    it.skipIf(!MAPBOX_TOKEN)(
      'should handle different travel modes',
      async () => {
        await provider.initialize({ accessToken: MAPBOX_TOKEN! });

        const baseOptions = {
          lng: -118.2437,
          lat: 34.0522, // Los Angeles
          minutes: [15],
        };

        try {
          // Test different modes
          const drivingResult = await provider.fetchIsochrone({ ...baseOptions, mode: 'driving' });
          const walkingResult = await provider.fetchIsochrone({ ...baseOptions, mode: 'walking' });
          const cyclingResult = await provider.fetchIsochrone({ ...baseOptions, mode: 'cycling' });

          // All should return valid results
          expect(drivingResult.features.length).toBeGreaterThan(0);
          expect(walkingResult.features.length).toBeGreaterThan(0);
          expect(cyclingResult.features.length).toBeGreaterThan(0);

          // Driving should cover largest area (rough heuristic)
          const getDrivingArea = (geojson: any) => {
            // Simple area estimation - not precise, just for sanity check
            const coords = geojson.features[0].geometry.coordinates[0];
            return coords.length; // More points = larger perimeter = larger area (rough)
          };

          expect(getDrivingArea(drivingResult)).toBeGreaterThan(
            getDrivingArea(walkingResult) * 0.5
          );
        } catch (error) {
          // Skip test if network is unavailable (sandbox environment)
          if (error instanceof Error && error.message.includes('Network request failed')) {
            console.warn('Skipping test: Network unavailable');
            return;
          }
          throw error;
        }
      },
      20000
    );

    it.skipIf(!MAPBOX_TOKEN)(
      'should handle multiple time contours',
      async () => {
        await provider.initialize({ accessToken: MAPBOX_TOKEN! });

        const options: IsochroneOptions = {
          lng: -87.6298,
          lat: 41.8781, // Chicago
          mode: 'driving',
          minutes: [5, 10, 15, 20],
        };

        try {
          const result = await provider.fetchIsochrone(options);

          // Should have 4 features (one per time contour)
          expect(result.features.length).toBe(4);

          // Contours should be in order (largest to smallest)
          const contours = result.features.map((f) => f.properties?.contour);
          expect(contours).toEqual([20, 15, 10, 5]);
        } catch (error) {
          // Skip test if network is unavailable (sandbox environment)
          if (error instanceof Error && error.message.includes('Network request failed')) {
            console.warn('Skipping test: Network unavailable');
            return;
          }
          throw error;
        }
      },
      10000
    );

    it.skipIf(!MAPBOX_TOKEN)(
      'should handle API errors gracefully',
      async () => {
        await provider.initialize({ accessToken: 'invalid_token_xxx' });

        const options: IsochroneOptions = {
          lng: -74.006,
          lat: 40.7128,
          mode: 'driving',
          minutes: [10],
        };

        // Should throw a meaningful error
        await expect(provider.fetchIsochrone(options)).rejects.toThrow();
      },
      10000
    );
  });

  describe('Provider Interoperability', () => {
    // UI provider tests require a real browser
    // Run these tests with: yarn test:browser:integration
    it.skipIf(!MAPTILER_KEY || !MAPBOX_TOKEN || !isBrowser)(
      'should use MapTiler for UI and Mapbox for API',
      async () => {
        // Initialize UI provider (MapTiler)
        const uiProvider = new MapTilerUIProvider();
        await uiProvider.initialize({ apiKey: MAPTILER_KEY! });

        const container = document.createElement('div');
        container.style.width = '400px';
        container.style.height = '300px';
        document.body.appendChild(container);

        const map = await uiProvider.createMap(container, {
          center: [-74.006, 40.7128],
          zoom: 11,
          style: 'streets-v2',
        });

        // Initialize API provider (Mapbox)
        const apiProvider = new MapboxAPIProvider();
        await apiProvider.initialize({ accessToken: MAPBOX_TOKEN! });

        // Fetch isochrone
        const isochrone = await apiProvider.fetchIsochrone({
          lng: -74.006,
          lat: 40.7128,
          mode: 'driving',
          minutes: [15],
        });

        // Both should work independently
        expect(map).toBeDefined();
        expect(isochrone.features.length).toBeGreaterThan(0);

        // In a real app, you'd add the isochrone to the map as a layer
        // map.addSource('isochrone', { type: 'geojson', data: isochrone });

        // Cleanup
        map.remove();
        document.body.removeChild(container);
      },
      15000
    );
  });
});
