import { describe, it, expect } from 'vitest';
import {
  toLatLon,
  toLonLat,
  isValidCoordinate,
  extractCoordinates,
  createPoint,
  serializeCoordinates,
  deserializeCoordinates,
  normalizeCoordinateInput,
  normalizeCoordinatesArray,
  roundCoordinates,
  roundCoord,
  removeDuplicateCoordinates,
  removeDuplicateCoordinatesFromGeometry,
} from '../src/coordinates';
import type { Point, LineString, Polygon } from '../src/types';

describe('coordinates', () => {
  describe('toLatLon', () => {
    it('should convert [lon, lat] to [lat, lon]', () => {
      const lonLat: [number, number] = [-74.006, 40.7128];
      const latLon = toLatLon(lonLat);
      expect(latLon).toEqual([40.7128, -74.006]);
    });
  });

  describe('toLonLat', () => {
    it('should convert [lat, lon] to [lon, lat]', () => {
      const latLon: [number, number] = [40.7128, -74.006];
      const lonLat = toLonLat(latLon);
      expect(lonLat).toEqual([-74.006, 40.7128]);
    });
  });

  describe('isValidCoordinate', () => {
    it('should return true for valid coordinates', () => {
      expect(isValidCoordinate([40.7128, -74.006])).toBe(true);
      expect(isValidCoordinate([0, 0])).toBe(true);
      expect(isValidCoordinate([90, 180])).toBe(true);
      expect(isValidCoordinate([-90, -180])).toBe(true);
    });

    it('should return false for invalid coordinates', () => {
      expect(isValidCoordinate([91, -74.006])).toBe(false); // Latitude out of range
      expect(isValidCoordinate([40.7128, 181])).toBe(false); // Longitude out of range
      expect(isValidCoordinate([NaN, -74.006])).toBe(false); // NaN
      expect(isValidCoordinate([40.7128, NaN])).toBe(false); // NaN
      expect(isValidCoordinate([40.7128])).toBe(false); // Wrong length
    });
  });

  describe('extractCoordinates', () => {
    it('should extract from [lat, lon] array', () => {
      const coords = extractCoordinates([40.7128, -74.006]);
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should extract from [lon, lat] array and convert', () => {
      const coords = extractCoordinates([-74.006, 40.7128]);
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should extract from {lat, lon} object', () => {
      const coords = extractCoordinates({ lat: 40.7128, lon: -74.006 });
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should extract from {latitude, longitude} object', () => {
      const coords = extractCoordinates({ latitude: 40.7128, longitude: -74.006 });
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should extract from GeoJSON Point', () => {
      const point = {
        type: 'Point' as const,
        coordinates: [-74.006, 40.7128],
      };
      const coords = extractCoordinates(point);
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should return null for invalid input', () => {
      expect(extractCoordinates(null)).toBe(null);
      expect(extractCoordinates(undefined)).toBe(null);
      expect(extractCoordinates({})).toBe(null);
    });
  });

  describe('createPoint', () => {
    it('should create GeoJSON Point from [lat, lon]', () => {
      const point = createPoint([40.7128, -74.006]);
      expect(point).toEqual({
        type: 'Point',
        coordinates: [-74.006, 40.7128],
      });
    });
  });

  describe('serializeCoordinates', () => {
    it('should serialize coordinates to JSON string', () => {
      const json = serializeCoordinates([40.7128, -74.006]);
      expect(json).toBe('{"lat":40.7128,"lon":-74.006}');
    });

    it('should handle negative coordinates', () => {
      const json = serializeCoordinates([-33.8688, 151.2093]);
      expect(json).toBe('{"lat":-33.8688,"lon":151.2093}');
    });
  });

  describe('deserializeCoordinates', () => {
    it('should deserialize from {lat, lon} JSON', () => {
      const coords = deserializeCoordinates('{"lat":40.7128,"lon":-74.006}');
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should deserialize from {latitude, longitude} JSON', () => {
      const coords = deserializeCoordinates('{"latitude":40.7128,"longitude":-74.006}');
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should deserialize from array JSON', () => {
      const coords = deserializeCoordinates('[40.7128,-74.006]');
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should return null for invalid JSON', () => {
      expect(deserializeCoordinates('invalid')).toBe(null);
      expect(deserializeCoordinates('{}')).toBe(null);
      expect(deserializeCoordinates('{"lat":40.7128}')).toBe(null);
    });

    it('should roundtrip serialize/deserialize', () => {
      const original: [number, number] = [40.7128, -74.006];
      const json = serializeCoordinates(original);
      const deserialized = deserializeCoordinates(json);
      expect(deserialized).toEqual(original);
    });
  });

  describe('normalizeCoordinateInput', () => {
    it('should normalize [lat, lon] array', () => {
      const coords = normalizeCoordinateInput([40.7128, -74.006]);
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should normalize {lat, lon} object', () => {
      const coords = normalizeCoordinateInput({ lat: 40.7128, lon: -74.006 });
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should normalize {latitude, longitude} object', () => {
      const coords = normalizeCoordinateInput({ latitude: 40.7128, longitude: -74.006 });
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should normalize GeoJSON Point', () => {
      const point = {
        type: 'Point' as const,
        coordinates: [-74.006, 40.7128] as [number, number],
      };
      const coords = normalizeCoordinateInput(point);
      expect(coords).toEqual([40.7128, -74.006]);
    });

    it('should return null for invalid input', () => {
      expect(normalizeCoordinateInput(null)).toBe(null);
      expect(normalizeCoordinateInput(undefined)).toBe(null);
    });
  });

  describe('normalizeCoordinatesArray', () => {
    it('should normalize [lat, lon] array to [lat, lon]', () => {
      const coords = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'latlng');
      expect(normalized).toEqual([
        [40.7128, -74.006],
        [40.758, -73.9855],
      ]);
    });

    it('should normalize [lon, lat] array to [lat, lon]', () => {
      const coords = [
        [-74.006, 40.7128],
        [-73.9855, 40.758],
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'lnglat');
      expect(normalized).toEqual([
        [40.7128, -74.006],
        [40.758, -73.9855],
      ]);
    });

    it('should normalize to [lon, lat] (GeoJSON) format', () => {
      const coords = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];
      const normalized = normalizeCoordinatesArray(coords, 'lonlat', 'latlng');
      expect(normalized).toEqual([
        [-74.006, 40.7128],
        [-73.9855, 40.758],
      ]);
    });

    it('should auto-detect format and normalize to [lat, lon]', () => {
      const coords = [
        [-74.006, 40.7128], // [lon, lat] - first value > 90
        [-73.9855, 40.758],
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'auto');
      expect(normalized).toEqual([
        [40.7128, -74.006],
        [40.758, -73.9855],
      ]);
    });

    it('should return empty array for empty input', () => {
      expect(normalizeCoordinatesArray([], 'latlon', 'auto')).toEqual([]);
    });

    it('should handle invalid coordinates gracefully', () => {
      const coords = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'auto');
      expect(normalized.length).toBe(coords.length);
    });

    it('should handle pole coordinates correctly', () => {
      const coords = [
        [90, 0], // North pole
        [-90, 0], // South pole
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'auto');
      expect(normalized[0][0]).toBe(90);
      expect(normalized[1][0]).toBe(-90);
    });

    it('should handle coordinates where first value has larger absolute value', () => {
      const coords = [
        [-120, 40], // First value > 90, so it's longitude
      ];
      const normalized = normalizeCoordinatesArray(coords, 'latlon', 'auto');
      expect(normalized[0]).toEqual([40, -120]);
    });
  });

  describe('extractCoordinates edge cases', () => {
    it('should handle array where first value > 90 (longitude)', () => {
      const coords = extractCoordinates([-120, 40]);
      expect(coords).toEqual([40, -120]);
    });

    it('should handle array where second value > 90 (longitude)', () => {
      const coords = extractCoordinates([40, -120]);
      expect(coords).toEqual([40, -120]);
    });

    it('should use heuristic when both values are in latitude range', () => {
      // When first has larger absolute value, treat as longitude
      const coords = extractCoordinates([-80, 40]);
      expect(coords).toEqual([40, -80]);
    });

    it('should handle coordinates near equator', () => {
      const coords = extractCoordinates([0, 0]);
      expect(coords).toEqual([0, 0]);
    });
  });

  describe('roundCoordinates', () => {
    it('should round Point coordinates', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.0060123456, 40.7128123456],
      };
      const rounded = roundCoordinates(point, 6);
      expect(rounded.coordinates[0]).toBe(-74.006012);
      expect(rounded.coordinates[1]).toBe(40.712812);
    });

    it('should round LineString coordinates', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74.0060123456, 40.7128123456],
          [-73.9855123456, 40.7580123456],
        ],
      };
      const rounded = roundCoordinates(lineString, 4);
      expect((rounded as LineString).coordinates[0][0]).toBe(-74.006);
      expect((rounded as LineString).coordinates[0][1]).toBe(40.7128);
    });

    it('should round Polygon coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0060123456, 40.7128123456],
            [-73.9855123456, 40.7128123456],
            [-73.9855123456, 40.7580123456],
            [-74.0060123456, 40.7580123456],
            [-74.0060123456, 40.7128123456],
          ],
        ],
      };
      const rounded = roundCoordinates(polygon, 2);
      expect((rounded as Polygon).coordinates[0][0][0]).toBe(-74.01);
    });

    it('should preserve elevation in 3D coordinates', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.0060123456, 40.7128123456, 100.5],
      };
      const rounded = roundCoordinates(point, 6);
      expect(rounded.coordinates[2]).toBe(100.5);
    });

    it('should use default precision of 6', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.0060123456, 40.7128123456],
      };
      const rounded = roundCoordinates(point);
      expect(rounded.coordinates[0]).toBe(-74.006012);
    });
  });

  describe('roundCoord', () => {
    it('should round a single coordinate value', () => {
      expect(roundCoord(40.7128123456, 6)).toBe(40.712812);
      expect(roundCoord(-74.0060123456, 4)).toBe(-74.006);
    });

    it('should use default precision of 6', () => {
      expect(roundCoord(40.7128123456)).toBe(40.712812);
    });

    it('should handle zero precision', () => {
      expect(roundCoord(40.7128, 0)).toBe(41);
    });
  });

  describe('removeDuplicateCoordinates', () => {
    it('should remove duplicate consecutive coordinates from array', () => {
      const coords = [
        [0, 0],
        [1, 1],
        [1, 1],
        [2, 2],
        [2, 2],
      ];
      const cleaned = removeDuplicateCoordinates(coords, false);
      expect(cleaned).toEqual([
        [0, 0],
        [1, 1],
        [2, 2],
      ]);
    });

    it('should preserve single coordinate (Point)', () => {
      const coord = [0, 0];
      const cleaned = removeDuplicateCoordinates(coord);
      expect(cleaned).toEqual([0, 0]);
    });

    it('should close polygon rings when closeRings is true', () => {
      const ring = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        // Missing closing point
      ];
      const cleaned = removeDuplicateCoordinates(ring, true);
      expect(cleaned).toEqual([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ]);
    });

    it('should not close rings when closeRings is false', () => {
      const ring = [
        [0, 0],
        [1, 0],
        [1, 1],
      ];
      const cleaned = removeDuplicateCoordinates(ring, false);
      expect(cleaned).toEqual([
        [0, 0],
        [1, 0],
        [1, 1],
      ]);
    });

    it('should handle already closed rings', () => {
      const ring = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ];
      const cleaned = removeDuplicateCoordinates(ring, true);
      expect(cleaned.length).toBe(5);
      expect(cleaned[0]).toEqual(cleaned[cleaned.length - 1]);
    });

    it('should handle nested arrays (MultiLineString)', () => {
      const coords = [
        [
          [0, 0],
          [1, 1],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
      ];
      const cleaned = removeDuplicateCoordinates(coords);
      expect(Array.isArray(cleaned)).toBe(true);
    });
  });

  describe('removeDuplicateCoordinatesFromGeometry', () => {
    it('should remove duplicates from Point', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [0, 0],
      };
      const cleaned = removeDuplicateCoordinatesFromGeometry(point);
      expect(cleaned).toEqual(point);
    });

    it('should remove duplicates from LineString', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [0, 0],
          [1, 1],
          [1, 1],
          [2, 2],
        ],
      };
      const cleaned = removeDuplicateCoordinatesFromGeometry(lineString, false);
      expect((cleaned as LineString).coordinates.length).toBe(3);
    });

    it('should remove duplicates from Polygon and close rings', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [1, 1],
            [0, 1],
          ],
        ],
      };
      const cleaned = removeDuplicateCoordinatesFromGeometry(polygon);
      const ring = (cleaned as Polygon).coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring[0]).toEqual(ring[ring.length - 1]); // Ring should be closed
    });

    it('should handle invalid geometry gracefully', () => {
      const invalid = null as any;
      const cleaned = removeDuplicateCoordinatesFromGeometry(invalid);
      expect(cleaned).toBe(invalid);
    });
  });
});
