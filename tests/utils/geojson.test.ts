import { describe, it, expect } from 'vitest';
import {
  getCoordinates,
  createFeature,
  createFeatureCollection,
  extractGeometry,
  formatJSONCompact,
  isValidPosition,
  isValidPoint,
  isValidLineString,
  isValidPolygon,
  isValidMultiPoint,
  isValidMultiLineString,
  isValidMultiPolygon,
  isValidGeometryCollection,
  isValidGeometry,
  isValidFeature,
  isValidFeatureCollection,
  validateGeoJSON,
  repairGeometry,
  repairFeature,
  repairFeatureCollection,
  repairGeoJSON,
  fixPolygonRingOrder,
  filterTinyPolygons,
  cleanGeometry,
  stripDegenerateInteriorRings,
  stripAcuteOuterRingSpikes,
} from '../../src/utils/geojson';
import type {
  Feature,
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
  FeatureCollection,
  Position,
} from '../../src/utils/types';

describe('geojson', () => {
  const pointGeometry: Point = {
    type: 'Point',
    coordinates: [-74.006, 40.7128],
  };

  const feature: Feature = {
    type: 'Feature',
    geometry: pointGeometry,
    properties: { name: 'New York' },
  };

  describe('getCoordinates', () => {
    it('should extract coordinates from Feature', () => {
      const coords = getCoordinates(feature);
      expect(coords).toEqual([-74.006, 40.7128]);
    });

    it('should extract coordinates from Geometry', () => {
      const coords = getCoordinates(pointGeometry);
      expect(coords).toEqual([-74.006, 40.7128]);
    });

    it('should return null for non-Point geometry', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74, 40],
            [-73, 40],
            [-73, 41],
            [-74, 41],
            [-74, 40],
          ],
        ],
      };
      const coords = getCoordinates(polygon);
      expect(coords).toBe(null);
    });
  });

  describe('createFeature', () => {
    it('should create a Feature from geometry', () => {
      const newFeature = createFeature(pointGeometry);
      expect(newFeature).toEqual({
        type: 'Feature',
        geometry: pointGeometry,
        properties: {},
      });
    });

    it('should create a Feature with properties', () => {
      const newFeature = createFeature(pointGeometry, { name: 'Test' });
      expect(newFeature).toEqual({
        type: 'Feature',
        geometry: pointGeometry,
        properties: { name: 'Test' },
      });
    });
  });

  describe('createFeatureCollection', () => {
    it('should create a FeatureCollection from features', () => {
      const features = [
        createFeature(pointGeometry, { name: 'Location 1' }),
        createFeature(pointGeometry, { name: 'Location 2' }),
      ];
      const collection = createFeatureCollection(features);
      expect(collection).toEqual({
        type: 'FeatureCollection',
        features,
      });
    });
  });

  describe('extractGeometry', () => {
    it('should extract geometry from Feature', () => {
      const geometry = extractGeometry(feature);
      expect(geometry).toEqual(pointGeometry);
    });

    it('should return null for invalid input', () => {
      expect(extractGeometry(null as any)).toBe(null);
      expect(extractGeometry({} as any)).toBe(null);
    });
  });

  describe('formatJSONCompact', () => {
    it('should format GeoJSON with compressed coordinates', () => {
      const feature = createFeature(pointGeometry, { name: 'Test' });
      const formatted = formatJSONCompact(feature);
      expect(formatted).toContain('[-74.006,40.7128]');
      expect(formatted).toContain('"name": "Test"');
    });

    it('should fully minify when minify option is true', () => {
      const feature = createFeature(pointGeometry);
      const minified = formatJSONCompact(feature, true);
      expect(minified).not.toContain('\n');
      expect(minified).not.toContain(' ');
    });

    it('should handle FeatureCollection', () => {
      const collection = createFeatureCollection([
        createFeature(pointGeometry, { id: 1 }),
        createFeature(pointGeometry, { id: 2 }),
      ]);
      const formatted = formatJSONCompact(collection);
      expect(formatted).toContain('FeatureCollection');
      expect(formatted).toContain('[-74.006,40.7128]');
    });
  });

  describe('isValidPosition', () => {
    it('should validate valid positions', () => {
      expect(isValidPosition([-74.006, 40.7128])).toBe(true);
      expect(isValidPosition([0, 0])).toBe(true);
      expect(isValidPosition([180, 90])).toBe(true);
      expect(isValidPosition([-180, -90])).toBe(true);
      expect(isValidPosition([-74.006, 40.7128, 10])).toBe(true);
    });

    it('should reject invalid positions', () => {
      expect(isValidPosition([-200, 40])).toBe(false);
      expect(isValidPosition([-74, 100])).toBe(false);
      expect(isValidPosition([-74])).toBe(false);
      expect(isValidPosition([-74, 40, 10, 20])).toBe(false);
      expect(isValidPosition('not an array')).toBe(false);
      expect(isValidPosition([-74, '40'])).toBe(false);
      expect(isValidPosition([-74, 40, '10'])).toBe(false);
    });
  });

  describe('isValidPoint', () => {
    it('should validate valid Point', () => {
      expect(isValidPoint(pointGeometry)).toBe(true);
    });

    it('should reject invalid Point', () => {
      expect(isValidPoint({ type: 'Point', coordinates: [-200, 40] })).toBe(false);
      expect(isValidPoint({ type: 'Point' })).toBe(false);
      expect(isValidPoint({ type: 'LineString', coordinates: [] })).toBe(false);
      expect(isValidPoint(null)).toBe(false);
    });
  });

  describe('isValidLineString', () => {
    it('should validate valid LineString', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74, 40],
          [-73, 41],
        ],
      };
      expect(isValidLineString(lineString)).toBe(true);
    });

    it('should reject invalid LineString', () => {
      expect(isValidLineString({ type: 'LineString', coordinates: [] })).toBe(false);
      expect(isValidLineString({ type: 'LineString', coordinates: [[-74, 40]] })).toBe(false);
      expect(
        isValidLineString({
          type: 'LineString',
          coordinates: [
            [-200, 40],
            [-73, 41],
          ],
        })
      ).toBe(false);
      expect(isValidLineString({ type: 'Point', coordinates: [-74, 40] })).toBe(false);
    });
  });

  describe('isValidPolygon', () => {
    it('should validate valid Polygon', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74, 40],
            [-73, 40],
            [-73, 41],
            [-74, 41],
            [-74, 40],
          ],
        ],
      };
      expect(isValidPolygon(polygon)).toBe(true);
    });

    it('should reject invalid Polygon', () => {
      expect(isValidPolygon({ type: 'Polygon', coordinates: [] })).toBe(false);
      expect(
        isValidPolygon({
          type: 'Polygon',
          coordinates: [
            [
              [-74, 40],
              [-73, 40],
              [-73, 41],
            ],
          ],
        })
      ).toBe(false); // Not closed
      expect(
        isValidPolygon({
          type: 'Polygon',
          coordinates: [
            [
              [-200, 40],
              [-73, 40],
              [-73, 41],
              [-200, 40],
            ],
          ],
        })
      ).toBe(false); // Invalid coordinates
    });
  });

  describe('isValidMultiPoint', () => {
    it('should validate valid MultiPoint', () => {
      const multiPoint: MultiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [-74, 40],
          [-73, 41],
        ],
      };
      expect(isValidMultiPoint(multiPoint)).toBe(true);
    });

    it('should reject invalid MultiPoint', () => {
      expect(isValidMultiPoint({ type: 'MultiPoint', coordinates: [[-200, 40]] })).toBe(false);
      expect(isValidMultiPoint({ type: 'Point', coordinates: [-74, 40] })).toBe(false);
    });
  });

  describe('isValidMultiLineString', () => {
    it('should validate valid MultiLineString', () => {
      const multiLineString: MultiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [-74, 40],
            [-73, 41],
          ],
        ],
      };
      expect(isValidMultiLineString(multiLineString)).toBe(true);
    });

    it('should reject invalid MultiLineString', () => {
      expect(isValidMultiLineString({ type: 'MultiLineString', coordinates: [[[-74, 40]]] })).toBe(
        false
      );
      expect(isValidMultiLineString({ type: 'LineString', coordinates: [] })).toBe(false);
    });
  });

  describe('isValidMultiPolygon', () => {
    it('should validate valid MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-74, 40],
              [-73, 40],
              [-73, 41],
              [-74, 41],
              [-74, 40],
            ],
          ],
        ],
      };
      expect(isValidMultiPolygon(multiPolygon)).toBe(true);
    });

    it('should reject invalid MultiPolygon', () => {
      expect(
        isValidMultiPolygon({
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-74, 40],
                [-73, 40],
                [-73, 41],
              ],
            ],
          ],
        })
      ).toBe(false);
    });
  });

  describe('isValidGeometryCollection', () => {
    it('should validate valid GeometryCollection', () => {
      const collection: GeometryCollection = {
        type: 'GeometryCollection',
        geometries: [pointGeometry],
      };
      expect(isValidGeometryCollection(collection)).toBe(true);
    });

    it('should reject invalid GeometryCollection', () => {
      expect(
        isValidGeometryCollection({
          type: 'GeometryCollection',
          geometries: [{ type: 'Point', coordinates: [-200, 40] }],
        })
      ).toBe(false);
    });
  });

  describe('isValidGeometry', () => {
    it('should validate all geometry types', () => {
      expect(isValidGeometry(pointGeometry)).toBe(true);

      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74, 40],
          [-73, 41],
        ],
      };
      expect(isValidGeometry(lineString)).toBe(true);
    });

    it('should reject invalid geometry', () => {
      expect(isValidGeometry({ type: 'InvalidType' })).toBe(false);
      expect(isValidGeometry(null)).toBe(false);
    });
  });

  describe('isValidFeature', () => {
    it('should validate valid Feature', () => {
      expect(isValidFeature(feature)).toBe(true);
    });

    it('should accept Feature with null geometry', () => {
      const featureWithNull: Feature = {
        type: 'Feature',
        geometry: null,
        properties: {},
      };
      expect(isValidFeature(featureWithNull)).toBe(true);
    });

    it('should reject invalid Feature', () => {
      expect(isValidFeature({ type: 'Feature' })).toBe(false);
      expect(
        isValidFeature({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-200, 40] },
        })
      ).toBe(false);
    });
  });

  describe('isValidFeatureCollection', () => {
    it('should validate valid FeatureCollection', () => {
      const collection = createFeatureCollection([feature]);
      expect(isValidFeatureCollection(collection)).toBe(true);
    });

    it('should reject invalid FeatureCollection', () => {
      expect(
        isValidFeatureCollection({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-200, 40] } }],
        })
      ).toBe(false);
    });
  });

  describe('validateGeoJSON', () => {
    it('should validate FeatureCollection', () => {
      const collection = createFeatureCollection([feature]);
      const result = validateGeoJSON(collection);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate Feature', () => {
      const result = validateGeoJSON(feature);
      expect(result.valid).toBe(true);
    });

    it('should validate Geometry', () => {
      const result = validateGeoJSON(pointGeometry);
      expect(result.valid).toBe(true);
    });

    it('should return error for invalid input', () => {
      const result = validateGeoJSON({ type: 'Invalid' });
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('repairGeometry', () => {
    it('should repair Point with invalid coordinates', () => {
      const invalidPoint = { type: 'Point', coordinates: [-200, 40] };
      const repaired = repairGeometry(invalidPoint);
      expect(repaired).toBe(null); // Invalid coordinates removed
    });

    it('should repair unclosed Polygon ring', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74, 40],
            [-73, 40],
            [-73, 41],
            [-74, 41],
            // Missing closing point
          ],
        ],
      };
      const repaired = repairGeometry(polygon);
      expect(repaired).not.toBe(null);
      if (repaired && repaired.type === 'Polygon') {
        const ring = repaired.coordinates[0];
        expect(ring[0]).toEqual(ring[ring.length - 1]); // Ring should be closed
      }
    });

    it('should remove duplicate coordinates', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74, 40],
          [-74, 40], // Duplicate
          [-73, 41],
        ],
      };
      const repaired = repairGeometry(lineString, { removeDuplicates: true });
      expect(repaired).not.toBe(null);
      if (repaired && repaired.type === 'LineString') {
        expect(repaired.coordinates.length).toBe(2);
      }
    });

    it('should round coordinates with precision option', () => {
      const point = {
        type: 'Point',
        coordinates: [-74.123456789, 40.987654321],
      };
      const repaired = repairGeometry(point, { coordinatePrecision: 2 });
      expect(repaired).not.toBe(null);
      if (repaired && repaired.type === 'Point') {
        expect(repaired.coordinates[0]).toBe(-74.12);
        expect(repaired.coordinates[1]).toBe(40.99);
      }
    });
  });

  describe('repairFeature', () => {
    it('should repair Feature with invalid geometry', () => {
      const invalidFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-200, 40] },
        properties: { name: 'Test' },
      };
      const repaired = repairFeature(invalidFeature);
      expect(repaired).toBe(null); // Invalid geometry removed
    });

    it('should handle Feature with null geometry', () => {
      const featureWithNull = {
        type: 'Feature',
        geometry: null,
        properties: { name: 'Test' },
      };
      const repaired = repairFeature(featureWithNull);
      expect(repaired).not.toBe(null);
      if (repaired) {
        expect(repaired.geometry).toBe(null);
      }
    });

    it('should remove null geometries when option is set', () => {
      const featureWithNull = {
        type: 'Feature',
        geometry: null,
        properties: {},
      };
      const repaired = repairFeature(featureWithNull, { removeNullGeometries: true });
      expect(repaired).toBe(null);
    });

    it('should return null for non-object input', () => {
      expect(repairFeature(null)).toBe(null);
      expect(repairFeature('not an object')).toBe(null);
      expect(repairFeature(123)).toBe(null);
    });

    it('should return null for invalid type', () => {
      const invalid = {
        type: 'NotAFeature',
        geometry: pointGeometry,
        properties: {},
      };
      expect(repairFeature(invalid)).toBe(null);
    });

    it('should handle feature with empty geometry when removeEmptyGeometries is false', () => {
      const featureWithEmpty = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [] },
        properties: { name: 'Test' },
      };
      const repaired = repairFeature(featureWithEmpty, { removeEmptyGeometries: false });
      expect(repaired).not.toBe(null);
      if (repaired) {
        expect(repaired.geometry).toBe(null);
      }
    });

    it('should preserve properties when repairing', () => {
      const featureWithProps = {
        type: 'Feature',
        geometry: pointGeometry,
        properties: { name: 'Test', id: 123 },
      };
      const repaired = repairFeature(featureWithProps);
      expect(repaired).not.toBe(null);
      if (repaired) {
        expect(repaired.properties).toEqual({ name: 'Test', id: 123 });
      }
    });

    it('should handle missing properties', () => {
      const featureNoProps = {
        type: 'Feature',
        geometry: pointGeometry,
      };
      const repaired = repairFeature(featureNoProps);
      expect(repaired).not.toBe(null);
      if (repaired) {
        expect(repaired.properties).toEqual({});
      }
    });
  });

  describe('repairFeatureCollection', () => {
    it('should repair FeatureCollection', () => {
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          feature,
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-200, 40] },
            properties: {},
          },
        ],
      };
      const repaired = repairFeatureCollection(collection);
      expect(repaired.type).toBe('FeatureCollection');
      expect(repaired.features.length).toBe(1); // Invalid feature removed
    });

    it('should handle invalid input gracefully', () => {
      const repaired = repairFeatureCollection(null);
      expect(repaired.type).toBe('FeatureCollection');
      expect(repaired.features).toEqual([]);
    });

    it('should handle non-object input', () => {
      expect(repairFeatureCollection('not an object').features).toEqual([]);
      expect(repairFeatureCollection(123).features).toEqual([]);
    });

    it('should handle wrong type', () => {
      const wrongType = {
        type: 'NotAFeatureCollection',
        features: [feature],
      };
      const repaired = repairFeatureCollection(wrongType);
      expect(repaired.type).toBe('FeatureCollection');
      expect(repaired.features).toEqual([]);
    });

    it('should handle missing features array', () => {
      const noFeatures = {
        type: 'FeatureCollection',
      };
      const repaired = repairFeatureCollection(noFeatures);
      expect(repaired.type).toBe('FeatureCollection');
      expect(repaired.features).toEqual([]);
    });

    it('should handle non-array features', () => {
      const invalidFeatures = {
        type: 'FeatureCollection',
        features: 'not an array',
      };
      const repaired = repairFeatureCollection(invalidFeatures);
      expect(repaired.type).toBe('FeatureCollection');
      expect(repaired.features).toEqual([]);
    });

    it('should pass options to repairFeature', () => {
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: null,
            properties: {},
          },
        ],
      };
      const repaired = repairFeatureCollection(collection, { removeNullGeometries: true });
      expect(repaired.features).toEqual([]);
    });
  });

  describe('repairGeoJSON', () => {
    it('should auto-detect and repair FeatureCollection', () => {
      const collection = createFeatureCollection([feature]);
      const repaired = repairGeoJSON(collection);
      expect(repaired).not.toBe(null);
      if (repaired && 'type' in repaired) {
        expect(repaired.type).toBe('FeatureCollection');
      }
    });

    it('should auto-detect and repair Feature', () => {
      const repaired = repairGeoJSON(feature);
      expect(repaired).not.toBe(null);
      if (repaired && 'type' in repaired) {
        expect(repaired.type).toBe('Feature');
      }
    });

    it('should auto-detect and repair Geometry', () => {
      const repaired = repairGeoJSON(pointGeometry);
      expect(repaired).not.toBe(null);
      if (repaired && 'type' in repaired) {
        expect(repaired.type).toBe('Point');
      }
    });

    it('should return null for invalid input', () => {
      expect(repairGeoJSON(null)).toBe(null);
      expect(repairGeoJSON('not an object')).toBe(null);
    });

    it('should return null for object without type or coordinates', () => {
      const invalid = {
        notType: 'something',
        notCoordinates: [],
      };
      expect(repairGeoJSON(invalid)).toBe(null);
    });

    it('should pass options to repair functions', () => {
      const featureWithNull = {
        type: 'Feature',
        geometry: null,
        properties: {},
      };
      const repaired = repairGeoJSON(featureWithNull, { removeNullGeometries: true });
      expect(repaired).toBe(null);
    });

    it('should handle FeatureCollection with options', () => {
      const collection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: null,
            properties: {},
          },
        ],
      };
      const repaired = repairGeoJSON(collection, { removeNullGeometries: true });
      expect(repaired).not.toBe(null);
      if (repaired && 'type' in repaired && repaired.type === 'FeatureCollection') {
        expect(repaired.features).toEqual([]);
      }
    });
  });

  describe('fixPolygonRingOrder', () => {
    it('should reorder rings so largest is first', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // Small ring (5 points)
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
          // Large ring (10 points) - should be moved to first
          [
            [-75.0, 40.0],
            [-73.0, 40.0],
            [-73.0, 41.0],
            [-75.0, 41.0],
            [-75.0, 40.5],
            [-74.5, 40.5],
            [-74.5, 40.2],
            [-75.0, 40.2],
            [-75.0, 40.0],
            [-75.0, 40.0],
          ],
        ],
      };

      const fixed = fixPolygonRingOrder(polygon);
      expect(fixed.coordinates[0].length).toBe(10);
      expect(fixed.coordinates[1].length).toBe(5);
    });

    it('should not reorder if largest ring is already first', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // Large ring first
          [
            [-75.0, 40.0],
            [-73.0, 40.0],
            [-73.0, 41.0],
            [-75.0, 41.0],
            [-75.0, 40.0],
          ],
          // Small ring
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };

      const fixed = fixPolygonRingOrder(polygon);
      expect(fixed.coordinates[0].length).toBe(5);
      expect(fixed.coordinates[1].length).toBe(5);
    });

    it('should return unchanged for single ring', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };

      const fixed = fixPolygonRingOrder(polygon);
      expect(fixed).toEqual(polygon);
    });

    it('should return unchanged for non-Polygon geometry', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.0, 40.7],
      };

      // @ts-expect-error - testing invalid input
      const result = fixPolygonRingOrder(point);
      expect(result).toEqual(point);
    });
  });

  describe('filterTinyPolygons', () => {
    it('should filter out polygons below minimum point count', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          // Tiny polygon (5 points) - should be removed
          [
            [
              [-74.0, 40.7],
              [-73.9, 40.7],
              [-73.9, 40.8],
              [-74.0, 40.8],
              [-74.0, 40.7],
            ],
          ],
          // Large polygon (15 points) - should be kept
          [
            [
              [-75.0, 40.0],
              [-73.0, 40.0],
              [-73.0, 41.0],
              [-75.0, 41.0],
              [-75.0, 40.5],
              [-74.5, 40.5],
              [-74.5, 40.2],
              [-75.0, 40.2],
              [-75.0, 40.1],
              [-74.8, 40.1],
              [-74.8, 40.3],
              [-74.6, 40.3],
              [-74.6, 40.4],
              [-74.7, 40.4],
              [-75.0, 40.0],
            ],
          ],
        ],
      };

      const filtered = filterTinyPolygons(multiPolygon, 10);
      expect(filtered.coordinates.length).toBe(1);
      expect(filtered.coordinates[0][0].length).toBe(15);
    });

    it('should keep at least the largest polygon if all are filtered', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-74.0, 40.7],
              [-73.9, 40.7],
              [-73.9, 40.8],
              [-74.0, 40.8],
              [-74.0, 40.7],
            ],
          ],
          [
            [
              [-75.0, 40.0],
              [-73.0, 40.0],
              [-73.0, 41.0],
              [-75.0, 41.0],
              [-75.0, 40.0],
            ],
          ],
        ],
      };

      // Filter with high threshold - all should be filtered, but largest kept
      const filtered = filterTinyPolygons(multiPolygon, 20);
      expect(filtered.coordinates.length).toBe(1);
      expect(filtered.coordinates[0][0].length).toBe(5); // Largest one
    });

    it('should return unchanged for non-MultiPolygon geometry', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };

      // @ts-expect-error - testing invalid input
      const result = filterTinyPolygons(polygon, 10);
      expect(result).toEqual(polygon);
    });
  });

  describe('cleanGeometry', () => {
    it('should remove NaN coordinates from Polygon', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [NaN, 40.7],
            [-73.9, 40.8],
            [-74.0, NaN],
            [-74.0, 40.7],
          ],
        ],
      };

      const cleaned = cleanGeometry(polygon);
      expect(cleaned.coordinates[0].length).toBe(3); // NaN coordinates removed
      expect(cleaned.coordinates[0].every((coord) => !isNaN(coord[0]) && !isNaN(coord[1]))).toBe(
        true
      );
    });

    it('should remove null coordinates from MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [[[-74.0, 40.7], null as unknown as [number, number], [-73.9, 40.8], [-74.0, 40.7]]],
        ],
      };

      const cleaned = cleanGeometry(multiPolygon);
      expect(cleaned.coordinates[0][0].length).toBe(3); // null coordinate removed
    });

    it('should remove invalid coordinates (non-finite)', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [Infinity, 40.7],
            [-73.9, 40.8],
            [-74.0, -Infinity],
            [-74.0, 40.7],
          ],
        ],
      };

      const cleaned = cleanGeometry(polygon);
      expect(cleaned.coordinates[0].length).toBe(3); // Invalid coordinates removed
      expect(
        cleaned.coordinates[0].every((coord) => isFinite(coord[0]) && isFinite(coord[1]))
      ).toBe(true);
    });

    it('should return original if all rings are invalid', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [NaN, NaN],
            [Infinity, Infinity],
          ],
        ],
      };

      const cleaned = cleanGeometry(polygon);
      // Should return original since all rings are invalid
      expect(cleaned).toEqual(polygon);
    });

    it('should handle nested coordinate arrays correctly', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };

      const cleaned = cleanGeometry(polygon);
      expect(cleaned).toEqual(polygon);
    });

    it('should return unchanged for non-Polygon/MultiPolygon geometry', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.0, 40.7],
      };

      // @ts-expect-error - testing invalid input
      const result = cleanGeometry(point);
      expect(result).toEqual(point);
    });
  });

  describe('stripDegenerateInteriorRings', () => {
    const outerRing: Position[] = [
      [-106.0, 39.5],
      [-104.5, 39.5],
      [-104.5, 41.0],
      [-106.0, 41.0],
      [-106.0, 39.5],
    ];

    it('removes thin vertical sliver holes', () => {
      const sliverHole: Position[] = [
        [-105.055, 40.0],
        [-105.0549, 40.0],
        [-105.0549, 40.07],
        [-105.055, 40.07],
        [-105.055, 40.0],
      ];

      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, sliverHole],
      };

      const stripped = stripDegenerateInteriorRings(polygon);
      expect(stripped.coordinates.length).toBe(1);
    });

    it('removes thin horizontal sliver holes', () => {
      const sliverHole: Position[] = [
        [-104.9, 40.0003],
        [-104.8, 40.0003],
        [-104.8, 40.00031],
        [-104.9, 40.00031],
        [-104.9, 40.0003],
      ];

      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, sliverHole],
      };

      const stripped = stripDegenerateInteriorRings(polygon);
      expect(stripped.coordinates.length).toBe(1);
    });

    it('keeps large interior rings', () => {
      const largeHole: Position[] = [
        [-105.5, 40.2],
        [-105.2, 40.2],
        [-105.2, 40.5],
        [-105.5, 40.5],
        [-105.5, 40.2],
      ];

      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, largeHole],
      };

      const stripped = stripDegenerateInteriorRings(polygon);
      expect(stripped.coordinates.length).toBe(2);
    });

    it('strips holes on each member of a MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            outerRing,
            [
              [-105.055, 40.0],
              [-105.0549, 40.0],
              [-105.0549, 40.07],
              [-105.055, 40.07],
              [-105.055, 40.0],
            ],
          ],
          [
            [
              [-105.0, 40.8],
              [-104.8, 40.8],
              [-104.8, 41.0],
              [-105.0, 41.0],
              [-105.0, 40.8],
            ],
          ],
        ],
      };

      const stripped = stripDegenerateInteriorRings(multiPolygon);
      expect(stripped.coordinates[0].length).toBe(1);
      expect(stripped.coordinates[1].length).toBe(1);
    });

    it('removes long thin holes even when Turf area exceeds 1 km²', () => {
      const longSliverHole: Position[] = [
        [-105.6, 40.0],
        [-105.0, 40.0],
        [-105.0, 40.00247],
        [-105.6, 40.00247],
        [-105.6, 40.0],
      ];

      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, longSliverHole],
      };

      const stripped = stripDegenerateInteriorRings(polygon);
      expect(stripped.coordinates.length).toBe(1);
    });

    it('removes narrow holes when minHoleWidthM2 is set', () => {
      const narrowHole: Position[] = [
        [-105.25, 40.1],
        [-105.247, 40.1],
        [-105.247, 40.18],
        [-105.25, 40.18],
        [-105.25, 40.1],
      ];

      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, narrowHole],
      };

      const kept = stripDegenerateInteriorRings(polygon, {
        minHoleWidthM2: 0,
        maxSliverAspect: 200,
      });
      expect(kept.coordinates.length).toBe(2);

      const stripped = stripDegenerateInteriorRings(polygon, {
        minHoleWidthM2: 500,
        maxSliverAspect: 200,
      });
      expect(stripped.coordinates.length).toBe(1);
    });
  });

  describe('stripAcuteOuterRingSpikes', () => {
    const outerRing: Position[] = [
      [-106.0, 39.5],
      [-104.5, 39.5],
      [-104.5, 41.0],
      [-106.0, 41.0],
      [-106.0, 39.5],
    ];

    it('removes micro-spikes on the outer ring', () => {
      const spike: Position[] = [
        [-105.0, 40.0],
        [-105.05, 40.05],
        [-105.055, 40.051],
        [-105.06, 40.05],
        [-105.1, 40.0],
      ];
      const ring = [...outerRing.slice(0, -1), ...spike, outerRing[0]];

      const polygon: Polygon = { type: 'Polygon', coordinates: [ring] };
      const stripped = stripAcuteOuterRingSpikes(polygon);
      expect(stripped.coordinates[0].length).toBeLessThan(ring.length);
    });

    it('preserves hole rings', () => {
      const largeHole: Position[] = [
        [-105.5, 40.2],
        [-105.2, 40.2],
        [-105.2, 40.5],
        [-105.5, 40.5],
        [-105.5, 40.2],
      ];
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [outerRing, largeHole],
      };

      const stripped = stripAcuteOuterRingSpikes(polygon);
      expect(stripped.coordinates.length).toBe(2);
    });
  });
});
