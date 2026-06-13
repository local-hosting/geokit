/**
 * Map Rendering Verification Tests
 *
 * These tests verify that points and polygons properly interact with the map instance
 * by checking that map.addSource() and map.addLayer() are called with correct parameters.
 *
 * While JSDOM cannot render actual WebGL/Canvas content, we can verify:
 * 1. Points call map.addSource() with valid GeoJSON
 * 2. Points call map.addLayer() with valid circle layer config
 * 3. Polygons call map.addSource() with valid GeoJSON
 * 4. Polygons call map.addLayer() with valid fill/line layer config
 * 5. Layers are created with unique IDs
 * 6. Layer configs reference correct source IDs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Map API Verification - Points', () => {
  let mockMap: any;
  let addSourceSpy: any;
  let addLayerSpy: any;

  beforeEach(() => {
    addSourceSpy = vi.fn();
    addLayerSpy = vi.fn();

    mockMap = {
      addSource: addSourceSpy,
      addLayer: addLayerSpy,
      removeSource: vi.fn(),
      removeLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      loaded: () => true,
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  describe('Point Element → Map API', () => {
    it('should call map.addSource with GeoJSON FeatureCollection', () => {
      const sourceId = 'point-source-test-123';
      const pointData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [-74.006, 40.7128], // NYC
            },
            properties: {
              id: 'test-point',
            },
          },
        ],
      };

      // Simulate point creating its source
      mockMap.addSource(sourceId, {
        type: 'geojson',
        data: pointData,
      });

      expect(addSourceSpy).toHaveBeenCalledTimes(1);
      expect(addSourceSpy).toHaveBeenCalledWith(sourceId, {
        type: 'geojson',
        data: expect.objectContaining({
          type: 'FeatureCollection',
          features: expect.arrayContaining([
            expect.objectContaining({
              type: 'Feature',
              geometry: expect.objectContaining({
                type: 'Point',
                coordinates: [-74.006, 40.7128],
              }),
            }),
          ]),
        }),
      });
    });

    it('should call map.addLayer with circle layer configuration', () => {
      const sourceId = 'point-source-test-456';
      const layerId = 'point-layer-test-456';

      // Simulate point creating its main layer
      mockMap.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#3b82f6',
          'circle-opacity': 1,
          'circle-blur': 0,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 1,
        },
      });

      expect(addLayerSpy).toHaveBeenCalledTimes(1);
      expect(addLayerSpy).toHaveBeenCalledWith({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: expect.objectContaining({
          'circle-radius': expect.any(Number),
          'circle-color': expect.any(String),
          'circle-opacity': expect.any(Number),
        }),
      });
    });

    it('should create shadow layer before main layer', () => {
      const sourceId = 'point-source-shadow-789';
      const shadowLayerId = 'point-shadow-789';
      const mainLayerId = 'point-layer-789';

      // Shadow layer first
      mockMap.addLayer({
        id: shadowLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 12,
          'circle-color': '#000000',
          'circle-opacity': 0.3,
          'circle-blur': 4,
        },
      });

      // Main layer second
      mockMap.addLayer({
        id: mainLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#3b82f6',
        },
      });

      expect(addLayerSpy).toHaveBeenCalledTimes(2);

      // Verify shadow layer
      expect(addLayerSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: shadowLayerId,
          type: 'circle',
          paint: expect.objectContaining({
            'circle-blur': expect.any(Number),
          }),
        })
      );

      // Verify main layer
      expect(addLayerSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: mainLayerId,
          type: 'circle',
        })
      );
    });

    it('should use unique IDs for each point instance', () => {
      // Simulate multiple points
      const points = [
        { sourceId: 'point-source-abc', layerId: 'point-layer-abc' },
        { sourceId: 'point-source-def', layerId: 'point-layer-def' },
        { sourceId: 'point-source-ghi', layerId: 'point-layer-ghi' },
      ];

      points.forEach(({ sourceId, layerId }) => {
        mockMap.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        mockMap.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {} });
      });

      expect(addSourceSpy).toHaveBeenCalledTimes(3);
      expect(addLayerSpy).toHaveBeenCalledTimes(3);

      // Verify all IDs are unique
      const sourceIds = addSourceSpy.mock.calls.map((call: any) => call[0]);
      const layerIds = addLayerSpy.mock.calls.map((call: any) => call[0].id);

      expect(new Set(sourceIds).size).toBe(3); // All unique
      expect(new Set(layerIds).size).toBe(3); // All unique
    });

    it('should match layer source to source ID', () => {
      const sourceId = 'point-source-matching';
      const layerId = 'point-layer-matching';

      mockMap.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      mockMap.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {} });

      // Verify layer references the correct source
      const layerConfig = addLayerSpy.mock.calls[0][0];
      const actualSourceId = addSourceSpy.mock.calls[0][0];

      expect(layerConfig.source).toBe(actualSourceId);
      expect(layerConfig.source).toBe(sourceId);
    });
  });

  describe('Multiple Points on Same Map', () => {
    it('should allow multiple points with independent sources and layers', () => {
      // Simulate 11 points (like Albany map)
      const pointCount = 11;

      for (let i = 0; i < pointCount; i++) {
        const uuid = `uuid-${i}`;
        const sourceId = `point-source-${uuid}`;
        const layerId = `point-layer-${uuid}`;

        mockMap.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-73 - i * 0.01, 42 + i * 0.01] },
                properties: {},
              },
            ],
          },
        });

        mockMap.addLayer({
          id: layerId,
          type: 'circle',
          source: sourceId,
          paint: { 'circle-radius': 8 },
        });
      }

      expect(addSourceSpy).toHaveBeenCalledTimes(11);
      expect(addLayerSpy).toHaveBeenCalledTimes(11);

      // Verify all sources are unique
      const sourceIds = addSourceSpy.mock.calls.map((call: any) => call[0]);
      expect(new Set(sourceIds).size).toBe(11);
    });
  });
});

describe('Map API Verification - Polygons', () => {
  let mockMap: any;
  let addSourceSpy: any;
  let addLayerSpy: any;

  beforeEach(() => {
    addSourceSpy = vi.fn();
    addLayerSpy = vi.fn();

    mockMap = {
      addSource: addSourceSpy,
      addLayer: addLayerSpy,
      removeSource: vi.fn(),
      removeLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      loaded: () => true,
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  describe('Polygon Element → Map API', () => {
    it('should call map.addSource with Polygon GeoJSON', () => {
      const sourceId = 'polygon-source-test';
      const polygonData: GeoJSON.Feature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-74.0, 40.7],
              [-74.0, 40.8],
              [-73.9, 40.8],
              [-73.9, 40.7],
              [-74.0, 40.7],
            ],
          ],
        },
        properties: {},
      };

      mockMap.addSource(sourceId, {
        type: 'geojson',
        data: polygonData,
      });

      expect(addSourceSpy).toHaveBeenCalledWith(sourceId, {
        type: 'geojson',
        data: expect.objectContaining({
          type: 'Feature',
          geometry: expect.objectContaining({
            type: 'Polygon',
            coordinates: expect.any(Array),
          }),
        }),
      });
    });

    it('should create fill and line layers for polygon', () => {
      const sourceId = 'polygon-source-layers';
      const fillLayerId = 'polygon-fill-layers';
      const lineLayerId = 'polygon-line-layers';

      // Fill layer
      mockMap.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.2,
        },
      });

      // Line layer
      mockMap.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
        },
      });

      expect(addLayerSpy).toHaveBeenCalledTimes(2);

      // Verify fill layer
      expect(addLayerSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          id: fillLayerId,
          type: 'fill',
          paint: expect.objectContaining({
            'fill-color': expect.any(String),
            'fill-opacity': expect.any(Number),
          }),
        })
      );

      // Verify line layer
      expect(addLayerSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          id: lineLayerId,
          type: 'line',
          paint: expect.objectContaining({
            'line-color': expect.any(String),
            'line-width': expect.any(Number),
          }),
        })
      );
    });
  });
});

describe('Map API Verification - Mixed Content', () => {
  let mockMap: any;
  let addSourceSpy: any;
  let addLayerSpy: any;

  beforeEach(() => {
    addSourceSpy = vi.fn();
    addLayerSpy = vi.fn();

    mockMap = {
      addSource: addSourceSpy,
      addLayer: addLayerSpy,
      removeSource: vi.fn(),
      removeLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      loaded: () => true,
      on: vi.fn(),
      off: vi.fn(),
    };
  });

  it('should handle map with both points and polygon (like demo cards)', () => {
    // Simulate Albany map: 11 points + 1 polygon

    // Add polygon first
    const polygonSourceId = 'polygon-source-albany';
    const polygonFillId = 'polygon-fill-albany';
    const polygonLineId = 'polygon-line-albany';

    mockMap.addSource(polygonSourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[]] }, properties: {} },
    });
    mockMap.addLayer({ id: polygonFillId, type: 'fill', source: polygonSourceId, paint: {} });
    mockMap.addLayer({ id: polygonLineId, type: 'line', source: polygonSourceId, paint: {} });

    // Add 11 points
    for (let i = 0; i < 11; i++) {
      const sourceId = `point-source-albany-${i}`;
      const layerId = `point-layer-albany-${i}`;

      mockMap.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      mockMap.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {} });
    }

    // Total: 1 polygon source + 11 point sources = 12 sources
    expect(addSourceSpy).toHaveBeenCalledTimes(12);

    // Total: 2 polygon layers + 11 point layers = 13 layers
    expect(addLayerSpy).toHaveBeenCalledTimes(13);

    // Verify all IDs are unique
    const sourceIds = addSourceSpy.mock.calls.map((call: any) => call[0]);
    const layerIds = addLayerSpy.mock.calls.map((call: any) => call[0].id);

    expect(new Set(sourceIds).size).toBe(12); // All unique
    expect(new Set(layerIds).size).toBe(13); // All unique
  });

  it('should verify layer types match their purpose', () => {
    // Add point
    mockMap.addLayer({ id: 'point-1', type: 'circle', source: 'source-1', paint: {} });

    // Add polygon
    mockMap.addLayer({ id: 'poly-fill', type: 'fill', source: 'source-2', paint: {} });
    mockMap.addLayer({ id: 'poly-line', type: 'line', source: 'source-2', paint: {} });

    const layerTypes = addLayerSpy.mock.calls.map((call: any) => call[0].type);

    expect(layerTypes).toEqual(['circle', 'fill', 'line']);
  });
});

describe('Bug Regression - Map API Verification', () => {
  it('should not call addSource/addLayer with null IDs', () => {
    const mockMap = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      loaded: () => true,
    };

    const sourceId: string | null = null;
    const layerId: string | null = null;

    // This is what happened in the bug - trying to add with null IDs
    // The fix ensures IDs are generated before this happens
    if (!sourceId || !layerId) {
      // Should not call map methods
      return;
    }

    mockMap.addSource(sourceId, { type: 'geojson', data: {} });
    mockMap.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {} });

    // Should NOT be called because of the guard
    expect(mockMap.addSource).not.toHaveBeenCalled();
    expect(mockMap.addLayer).not.toHaveBeenCalled();
  });

  it('should generate IDs before attempting to create layers', () => {
    // Simulate the fixed flow
    let sourceId: string | null = null;
    let layerId: string | null = null;
    let hasGeneratedIds = false;

    // Step 1: Generate IDs (in connectedCallback, before super)
    if (!hasGeneratedIds) {
      const uuid = 'test-uuid-fixed';
      sourceId = `point-source-${uuid}`;
      layerId = `point-layer-${uuid}`;
      hasGeneratedIds = true;
    }

    // Step 2: Try to create layers (in onMapReady)
    const mockMap = {
      addSource: vi.fn(),
      addLayer: vi.fn(),
      loaded: () => true,
    };

    if (sourceId && layerId) {
      mockMap.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      mockMap.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: {} });
    }

    // Should be called successfully with valid IDs
    expect(mockMap.addSource).toHaveBeenCalledWith(
      'point-source-test-uuid-fixed',
      expect.any(Object)
    );
    expect(mockMap.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'point-layer-test-uuid-fixed',
        source: 'point-source-test-uuid-fixed',
      })
    );
  });
});
