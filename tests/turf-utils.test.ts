import { describe, it, expect } from 'vitest';
import {
  createPointFeature,
  createLineString,
  extractLatLon,
  validatePolygon,
} from '../src/turf-utils';
import { toLonLatArray } from '../src/coordinates/conversion';
import type { Feature, Point, Polygon } from '../src/types';

describe('turf-utils', () => {
  describe('createPointFeature', () => {
    it('should create a Point Feature from LatLon', () => {
      const point = createPointFeature([40.7128, -74.006]);
      expect(point.type).toBe('Feature');
      expect(point.geometry.type).toBe('Point');
      expect(point.geometry.coordinates).toEqual([-74.006, 40.7128]);
    });

    it('should handle negative coordinates', () => {
      const point = createPointFeature([-33.8688, 151.2093]);
      expect(point.geometry.coordinates).toEqual([151.2093, -33.8688]);
    });

    it('should handle zero coordinates', () => {
      const point = createPointFeature([0, 0]);
      expect(point.geometry.coordinates).toEqual([0, 0]);
    });
  });

  describe('createLineString', () => {
    it('should create a LineString Feature from two LatLon points', () => {
      const line = createLineString([40.7128, -74.006], [34.0522, -118.2437]);
      expect(line.type).toBe('Feature');
      expect(line.geometry.type).toBe('LineString');
      expect(line.geometry.coordinates).toEqual([
        [-74.006, 40.7128],
        [-118.2437, 34.0522],
      ]);
    });

    it('should handle same point twice', () => {
      const line = createLineString([40.7128, -74.006], [40.7128, -74.006]);
      expect(line.geometry.coordinates).toEqual([
        [-74.006, 40.7128],
        [-74.006, 40.7128],
      ]);
    });
  });

  describe('toLonLatArray', () => {
    it('should convert LatLon array to LonLat array', () => {
      const points: [number, number][] = [
        [40.7128, -74.006],
        [34.0522, -118.2437],
      ];
      const result = toLonLatArray(points);
      expect(result).toEqual([
        [-74.006, 40.7128],
        [-118.2437, 34.0522],
      ]);
    });

    it('should handle empty array', () => {
      const result = toLonLatArray([]);
      expect(result).toEqual([]);
    });

    it('should handle single point', () => {
      const result = toLonLatArray([[40.7128, -74.006]]);
      expect(result).toEqual([[-74.006, 40.7128]]);
    });
  });

  describe('extractLatLon', () => {
    it('should extract LatLon from valid Point Feature', () => {
      const feature: Feature<Point> = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-74.006, 40.7128],
        },
        properties: {},
      };
      const result = extractLatLon(feature);
      expect(result).toEqual([40.7128, -74.006]);
    });

    it('should return null for invalid Point Feature', () => {
      const feature: Feature<Point> = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [],
        },
        properties: {},
      };
      const result = extractLatLon(feature);
      expect(result).toBeNull();
    });

    it('should return null for Point with insufficient coordinates', () => {
      const feature: Feature<Point> = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [-74.006] as any,
        },
        properties: {},
      };
      const result = extractLatLon(feature);
      expect(result).toBeNull();
    });

    it('should handle negative coordinates', () => {
      const feature: Feature<Point> = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [151.2093, -33.8688],
        },
        properties: {},
      };
      const result = extractLatLon(feature);
      expect(result).toEqual([-33.8688, 151.2093]);
    });

    it('should roundtrip with createPointFeature', () => {
      const original: [number, number] = [40.7128, -74.006];
      const feature = createPointFeature(original);
      const extracted = extractLatLon(feature);
      expect(extracted).toEqual(original);
    });
  });

  describe('validatePolygon', () => {
    it('should return true for valid polygon', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            [-74.01, 40.72],
            [-74.01, 40.71],
          ],
        ],
      };
      expect(validatePolygon(polygon)).toBe(true);
    });

    it('should return false for polygon with no coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [],
      };
      expect(validatePolygon(polygon)).toBe(false);
    });

    it('should return false for polygon with empty outer ring', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [[]],
      };
      expect(validatePolygon(polygon)).toBe(false);
    });

    it('should return false for polygon with insufficient points', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            // Only 3 points, need at least 4 for closed ring
          ],
        ],
      };
      expect(validatePolygon(polygon)).toBe(false);
    });

    it('should return true for polygon with exactly 4 points (minimum)', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            [-74.01, 40.71], // Closed ring
          ],
        ],
      };
      expect(validatePolygon(polygon)).toBe(true);
    });

    it('should return true for polygon with holes', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            [-74.01, 40.72],
            [-74.01, 40.71],
          ],
          [
            [-74.005, 40.715],
            [-74.002, 40.715],
            [-74.002, 40.717],
            [-74.005, 40.717],
            [-74.005, 40.715],
          ],
        ],
      };
      expect(validatePolygon(polygon)).toBe(true);
    });
  });
});
