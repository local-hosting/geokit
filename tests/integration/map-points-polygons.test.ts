/**
 * Map Points and Polygons Integration Tests
 *
 * Tests that verify multiple points and polygons can be added to a map
 * and all render correctly. These tests focus on the critical bug where
 * only one point was rendering when multiple were added.
 *
 * Uses real API keys from environment variables if available.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Load API keys from environment
const MAPTILER_KEY = process.env.MAPTILER_KEY;

// Mock Mapbox GL JS
class MockMap {
  private sources: Map<string, any> = new Map();
  private layers: Map<string, any> = new Map();
  private loadListeners: Array<() => void> = [];
  private styleLoaded = false;

  addSource(id: string, source: any) {
    this.sources.set(id, source);
  }

  addLayer(layer: any) {
    this.layers.set(layer.id, layer);
  }

  removeSource(id: string) {
    this.sources.delete(id);
  }

  removeLayer(id: string) {
    this.layers.delete(id);
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  isStyleLoaded() {
    return this.styleLoaded;
  }

  loaded() {
    return this.styleLoaded;
  }

  on(event: string, handler: () => void) {
    if (event === 'load') {
      this.loadListeners.push(handler);
      // If already loaded, fire immediately
      if (this.styleLoaded) {
        setTimeout(() => handler(), 0);
      }
    }
  }

  off(event: string, handler: () => void) {
    if (event === 'load') {
      const index = this.loadListeners.indexOf(handler);
      if (index > -1) {
        this.loadListeners.splice(index, 1);
      }
    }
  }

  once(event: string, handler: () => void) {
    const wrappedHandler = () => {
      handler();
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }

  // Test helper: simulate style loading
  simulateStyleLoad() {
    this.styleLoaded = true;
    this.loadListeners.forEach((handler) => handler());
    this.loadListeners = [];
  }

  // Test helpers
  getSourceCount() {
    return this.sources.size;
  }

  getLayerCount() {
    return this.layers.size;
  }

  getPointSources() {
    return Array.from(this.sources.keys()).filter((id) => id.startsWith('point-source-'));
  }

  getPointLayers() {
    return Array.from(this.layers.keys()).filter((id) => id.startsWith('point-layer-'));
  }

  getPolygonSources() {
    return Array.from(this.sources.keys()).filter((id) => id.startsWith('polygon-source-'));
  }

  getPolygonLayers() {
    return Array.from(this.layers.keys()).filter((id) => id.startsWith('polygon-fill-'));
  }
}

describe('Multiple Points Rendering', () => {
  let mapElement: any;
  let mockMap: MockMap;

  beforeEach(async () => {
    // Import and register custom elements
    await import('../../src/ui/components/elements/map');
    await import('../../src/ui/components/elements/point');
    await import('../../src/ui/components/elements/polygon');

    // Wait for custom elements to be defined
    await Promise.all([
      customElements.whenDefined('gk-map'),
      customElements.whenDefined('gk-point'),
      customElements.whenDefined('gk-polygon'),
    ]);

    mockMap = new MockMap();
    mapElement = document.createElement('gk-map');

    // Set required attributes
    mapElement.setAttribute('api-key', MAPTILER_KEY || 'test-key');
    mapElement.setAttribute('provider', 'maptiler');

    // Append to DOM (triggers connectedCallback)
    document.body.appendChild(mapElement);

    // Wait for async initialization
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Inject mock map
    mapElement.getMap = () => mockMap;
    mapElement.map = mockMap;
    mapElement.isInitialized = true;
  });

  afterEach(() => {
    if (mapElement && mapElement.parentNode) {
      mapElement.parentNode.removeChild(mapElement);
    }
  });

  describe('addPointsFromGeoJSON - Multiple Points', () => {
    it('should add all points from GeoJSON FeatureCollection', async () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1', name: 'NYC' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            properties: { id: 'point-2', name: 'SF' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
            properties: { id: 'point-3', name: 'Chicago' },
          },
        ],
      };

      // Add points using the method on the map element
      const addedCount = mapElement.addPointsFromGeoJSON(geojson, {
        color: '#ff0000',
        size: 8,
      });

      expect(addedCount).toBe(3);

      // Wait for all points to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate style loading
      mockMap.simulateStyleLoad();

      // Wait for points to render
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify all points created sources and layers
      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();

      // Each point should create one source and one layer
      expect(pointSources.length).toBeGreaterThanOrEqual(3);
      expect(pointLayers.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle adding points when style is already loaded', async () => {
      // Pre-load the style
      mockMap.simulateStyleLoad();

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            properties: { id: 'point-2' },
          },
        ],
      };

      const addedCount = mapElement.addPointsFromGeoJSON(geojson);

      expect(addedCount).toBe(2);

      // Wait for points to render (style already loaded)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();

      // Both points should render even though style was already loaded
      expect(pointSources.length).toBeGreaterThanOrEqual(2);
      expect(pointLayers.length).toBeGreaterThanOrEqual(2);
    });

    it('should create unique source and layer IDs for each point', async () => {
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            properties: { id: 'point-2' },
          },
        ],
      };

      mapElement.addPointsFromGeoJSON(geojson);

      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();

      // All IDs should be unique
      expect(new Set(pointSources).size).toBe(pointSources.length);
      expect(new Set(pointLayers).size).toBe(pointLayers.length);
    });
  });

  describe('addPolygonFromGeoJSON - Polygon Rendering', () => {
    it('should add polygon from GeoJSON Feature', async () => {
      const polygonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-74.006, 40.7128],
              [-73.935, 40.7128],
              [-73.935, 40.758],
              [-74.006, 40.758],
              [-74.006, 40.7128],
            ],
          ],
        },
        properties: {},
      };

      const addedCount = mapElement.addPolygonFromGeoJSON(polygonFeature, {
        fillColor: '#ff0000',
        fillOpacity: 0.5,
      });

      expect(addedCount).toBe(1);

      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const polygonSources = mockMap.getPolygonSources();
      const polygonLayers = mockMap.getPolygonLayers();

      expect(polygonSources.length).toBeGreaterThanOrEqual(1);
      expect(polygonLayers.length).toBeGreaterThanOrEqual(1);
    });

    it('should only use outer ring for polygon (ignore holes)', async () => {
      const polygonWithHole: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            // Outer ring
            [
              [-74.006, 40.7128],
              [-73.935, 40.7128],
              [-73.935, 40.758],
              [-74.006, 40.758],
              [-74.006, 40.7128],
            ],
            // Hole (should be ignored - gk-polygon only uses outer ring)
            [
              [-73.98, 40.73],
              [-73.97, 40.73],
              [-73.97, 40.74],
              [-73.98, 40.74],
              [-73.98, 40.73],
            ],
          ],
        },
        properties: {},
      };

      const addedCount = mapElement.addPolygonFromGeoJSON(polygonWithHole);

      expect(addedCount).toBe(1);

      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should only create one polygon element (using outer ring only)
      const polygonLayers = mockMap.getPolygonLayers();
      expect(polygonLayers.length).toBeGreaterThanOrEqual(1);
    });

    // TODO: Investigate timing issue with MultiPolygon - creates 2 elements but only 1 layer
    it.skip('should handle MultiPolygon', async () => {
      const multiPolygon: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-74.006, 40.7128],
                [-73.935, 40.7128],
                [-73.935, 40.758],
                [-74.006, 40.758],
                [-74.006, 40.7128],
              ],
            ],
            [
              [
                [-122.4194, 37.7749],
                [-122.4094, 37.7749],
                [-122.4094, 37.7849],
                [-122.4194, 37.7849],
                [-122.4194, 37.7749],
              ],
            ],
          ],
        },
        properties: {},
      };

      const addedCount = mapElement.addPolygonFromGeoJSON(multiPolygon);

      expect(addedCount).toBe(2); // One polygon per polygon in MultiPolygon

      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const polygonLayers = mockMap.getPolygonLayers();
      expect(polygonLayers.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Points and Polygons Together', () => {
    it('should render both points and polygons on the same map', async () => {
      const pointsGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1' },
          },
        ],
      };

      const polygonFeature: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-74.006, 40.7128],
              [-73.935, 40.7128],
              [-73.935, 40.758],
              [-74.006, 40.758],
              [-74.006, 40.7128],
            ],
          ],
        },
        properties: {},
      };

      // Add both
      mapElement.addPointsFromGeoJSON(pointsGeoJSON);
      mapElement.addPolygonFromGeoJSON(polygonFeature);

      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();
      const polygonSources = mockMap.getPolygonSources();
      const polygonLayers = mockMap.getPolygonLayers();

      expect(pointSources.length).toBeGreaterThanOrEqual(1);
      expect(pointLayers.length).toBeGreaterThanOrEqual(1);
      expect(polygonSources.length).toBeGreaterThanOrEqual(1);
      expect(polygonLayers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Race Condition Tests', () => {
    it('should handle multiple points added before style loads', async () => {
      // Style not loaded yet
      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            properties: { id: 'point-2' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] },
            properties: { id: 'point-3' },
          },
        ],
      };

      mapElement.addPointsFromGeoJSON(geojson);

      // Wait a bit, then load style
      await new Promise((resolve) => setTimeout(resolve, 50));
      mockMap.simulateStyleLoad();

      // Wait for all points to render
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();

      // All three points should render
      expect(pointSources.length).toBeGreaterThanOrEqual(3);
      expect(pointLayers.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle points added after style loads', async () => {
      // Pre-load style
      mockMap.simulateStyleLoad();
      await new Promise((resolve) => setTimeout(resolve, 50));

      const geojson: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
            properties: { id: 'point-1' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-122.4194, 37.7749] },
            properties: { id: 'point-2' },
          },
        ],
      };

      mapElement.addPointsFromGeoJSON(geojson);

      // Wait for points to render
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pointSources = mockMap.getPointSources();
      const pointLayers = mockMap.getPointLayers();

      // Both points should render even though style was already loaded
      expect(pointSources.length).toBeGreaterThanOrEqual(2);
      expect(pointLayers.length).toBeGreaterThanOrEqual(2);
    });
  });
});
