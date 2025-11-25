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
} from '../src/geojson';
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
} from '../src/types';

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
});
