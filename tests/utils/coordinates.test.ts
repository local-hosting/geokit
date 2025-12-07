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
  geojsonPolygonToLatLon,
  countPointsInGeometry,
} from '../../src/utils/coordinates';
import type { Point, LineString, Polygon, MultiPolygon } from '../../src/utils/types';

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

  describe('geojsonPolygonToLatLon', () => {
    it('should convert Polygon from [lon, lat] to [lat, lon]', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result).toHaveLength(1);
      expect(result![0]).toEqual([
        [40.6, -74.1],
        [40.6, -73.9],
        [40.8, -73.9],
        [40.8, -74.1],
        [40.6, -74.1],
      ]);
    });

    it('should convert MultiPolygon to array of [lat, lon] polygons', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-74.1, 40.6],
              [-73.9, 40.6],
              [-73.9, 40.8],
              [-74.1, 40.8],
              [-74.1, 40.6],
            ],
          ],
          [
            [
              [-74.2, 40.5],
              [-74.0, 40.5],
              [-74.0, 40.7],
              [-74.2, 40.7],
              [-74.2, 40.5],
            ],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(multiPolygon);
      expect(result).not.toBe(null);
      expect(result).toHaveLength(2);
      expect(result![0]).toEqual([
        [40.6, -74.1],
        [40.6, -73.9],
        [40.8, -73.9],
        [40.8, -74.1],
        [40.6, -74.1],
      ]);
      expect(result![1]).toEqual([
        [40.5, -74.2],
        [40.5, -74.0],
        [40.7, -74.0],
        [40.7, -74.2],
        [40.5, -74.2],
      ]);
    });

    it('should return null for invalid polygon', () => {
      const invalid = {
        type: 'Polygon',
        coordinates: [],
      } as Polygon;
      const result = geojsonPolygonToLatLon(invalid);
      expect(result).toBe(null);
    });

    it('should return null for null input', () => {
      const result = geojsonPolygonToLatLon(null as any);
      expect(result).toBe(null);
    });

    it('should handle polygon with multiple rings (use largest ring)', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // Small ring (should be ignored if there's a larger one)
          [
            [-74.05, 40.71],
            [-74.04, 40.71],
            [-74.04, 40.72],
            [-74.05, 40.72],
            [-74.05, 40.71],
          ],
          // Large ring (should be used)
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      // Should use the larger ring
      expect(result![0].length).toBeGreaterThan(5);
    });

    it('should handle empty MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [],
      };
      const result = geojsonPolygonToLatLon(multiPolygon);
      expect(result).toBe(null);
    });

    it('should handle MultiPolygon with invalid polygons', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-74.1, 40.6],
              [-73.9, 40.6],
              [-73.9, 40.8],
              [-74.1, 40.8],
              [-74.1, 40.6],
            ],
          ],
          [[]], // Invalid empty polygon
        ],
      };
      const result = geojsonPolygonToLatLon(multiPolygon);
      expect(result).not.toBe(null);
      // Should return valid polygons only
      expect(result!.length).toBeGreaterThan(0);
    });

    it('should handle polygon with exactly 10 points in first ring (boundary case)', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // First ring with exactly 10 points
          [
            [-74.1, 40.6],
            [-74.0, 40.6],
            [-73.9, 40.6],
            [-73.8, 40.6],
            [-73.7, 40.6],
            [-73.6, 40.6],
            [-73.5, 40.6],
            [-73.4, 40.6],
            [-73.3, 40.6],
            [-73.2, 40.6],
          ],
          // Second ring with more points (should not be used since first has >= 10)
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      // Should use first ring since it has >= 10 points
      expect(result![0].length).toBe(10);
    });

    it('should handle polygon with first ring having 9 points and second having 20', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // First ring with 9 points (< 10)
          [
            [-74.1, 40.6],
            [-74.0, 40.6],
            [-73.9, 40.6],
            [-73.8, 40.6],
            [-73.7, 40.6],
            [-73.6, 40.6],
            [-73.5, 40.6],
            [-73.4, 40.6],
            [-73.3, 40.6],
          ],
          // Second ring with 20 points (should be used since it's > 2x first)
          Array.from({ length: 20 }, (_, i) => [-74.1 + (i / 20) * 0.2, 40.6 + (i / 20) * 0.2]),
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      // Should use larger ring
      expect(result![0].length).toBe(20);
    });

    it('should handle polygon with multiple rings where largest is not 2x first', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // First ring with 8 points
          [
            [-74.1, 40.6],
            [-74.0, 40.6],
            [-73.9, 40.6],
            [-73.8, 40.6],
            [-73.7, 40.6],
            [-73.6, 40.6],
            [-73.5, 40.6],
            [-73.4, 40.6],
          ],
          // Second ring with 10 points (not 2x, so first should be used)
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
            [-74.1, 40.6],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      // Should use first ring since second is not 2x larger
      expect(result![0].length).toBe(8);
    });

    it('should handle polygon with 3D coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.1, 40.6, 100],
            [-73.9, 40.6, 100],
            [-73.9, 40.8, 100],
            [-74.1, 40.8, 100],
            [-74.1, 40.6, 100],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0]).toEqual([
        [40.6, -74.1],
        [40.6, -73.9],
        [40.8, -73.9],
        [40.8, -74.1],
        [40.6, -74.1],
      ]);
    });

    it('should handle polygon with coordinates at antimeridian', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [179, 0],
            [180, 0],
            [180, 1],
            [179, 1],
            [179, 0],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0]).toEqual([
        [0, 179],
        [0, 180],
        [1, 180],
        [1, 179],
        [0, 179],
      ]);
    });

    it('should handle polygon with coordinates at poles', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-10, 89],
            [10, 89],
            [10, 90],
            [-10, 90],
            [-10, 89],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0]).toEqual([
        [89, -10],
        [89, 10],
        [90, 10],
        [90, -10],
        [89, -10],
      ]);
    });

    it('should handle polygon with negative coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-120, -45],
            [-100, -45],
            [-100, -30],
            [-120, -30],
            [-120, -45],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0]).toEqual([
        [-45, -120],
        [-45, -100],
        [-30, -100],
        [-30, -120],
        [-45, -120],
      ]);
    });

    it('should handle MultiPolygon with many polygons', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: Array.from({ length: 10 }, (_, i) => [
          [
            [-74.1 - i * 0.1, 40.6],
            [-73.9 - i * 0.1, 40.6],
            [-73.9 - i * 0.1, 40.8],
            [-74.1 - i * 0.1, 40.8],
            [-74.1 - i * 0.1, 40.6],
          ],
        ]),
      };
      const result = geojsonPolygonToLatLon(multiPolygon);
      expect(result).not.toBe(null);
      expect(result!.length).toBe(10);
    });

    it('should handle polygon with single coordinate point (degenerate)', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.71],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0].length).toBe(3);
    });

    it('should handle polygon with very small coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.000001, 40.710001],
            [-74.000002, 40.710001],
            [-74.000002, 40.710002],
            [-74.000001, 40.710002],
            [-74.000001, 40.710001],
          ],
        ],
      };
      const result = geojsonPolygonToLatLon(polygon);
      expect(result).not.toBe(null);
      expect(result![0].length).toBe(5);
    });
  });

  describe('countPointsInGeometry', () => {
    it('should count points in Point geometry', () => {
      const point: Point = {
        type: 'Point',
        coordinates: [-74.006, 40.7128],
      };
      expect(countPointsInGeometry(point)).toBe(1);
    });

    it('should count points in LineString geometry', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74.006, 40.7128],
          [-73.9855, 40.758],
          [-73.97, 40.77],
        ],
      };
      expect(countPointsInGeometry(lineString)).toBe(3);
    });

    it('should count points in Polygon geometry', () => {
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
      expect(countPointsInGeometry(polygon)).toBe(5);
    });

    it('should count points in Polygon with holes', () => {
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
      expect(countPointsInGeometry(polygon)).toBe(10);
    });

    it('should count points in MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [-74.01, 40.71],
              [-74.0, 40.71],
              [-74.0, 40.72],
              [-74.01, 40.72],
              [-74.01, 40.71],
            ],
          ],
          [
            [
              [-75.0, 40.5],
              [-74.9, 40.5],
              [-74.9, 40.6],
              [-75.0, 40.6],
              [-75.0, 40.5],
            ],
          ],
        ],
      };
      expect(countPointsInGeometry(multiPolygon)).toBe(10);
    });

    it('should return 0 for null geometry', () => {
      expect(countPointsInGeometry(null)).toBe(0);
    });

    it('should return 0 for undefined geometry', () => {
      expect(countPointsInGeometry(undefined)).toBe(0);
    });

    it('should return 0 for invalid geometry', () => {
      const invalid = {} as any;
      expect(countPointsInGeometry(invalid)).toBe(0);
    });

    it('should count points in MultiPoint', () => {
      const multiPoint = {
        type: 'MultiPoint',
        coordinates: [
          [-74.006, 40.7128],
          [-73.9855, 40.758],
          [-73.97, 40.77],
        ],
      };
      expect(countPointsInGeometry(multiPoint)).toBe(3);
    });

    it('should count points in MultiLineString', () => {
      const multiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [-74.006, 40.7128],
            [-73.9855, 40.758],
          ],
          [
            [-75.0, 40.5],
            [-74.9, 40.5],
          ],
        ],
      };
      expect(countPointsInGeometry(multiLineString)).toBe(4);
    });

    it('should handle empty coordinates', () => {
      const emptyLineString: LineString = {
        type: 'LineString',
        coordinates: [],
      };
      expect(countPointsInGeometry(emptyLineString)).toBe(0);
    });

    it('should return 0 for GeometryCollection (not supported - uses geometries not coordinates)', () => {
      const geometryCollection = {
        type: 'GeometryCollection',
        geometries: [
          {
            type: 'Point',
            coordinates: [-74.006, 40.7128],
          },
          {
            type: 'LineString',
            coordinates: [
              [-73.9855, 40.758],
              [-73.97, 40.77],
            ],
          },
        ],
      };
      // GeometryCollection doesn't have 'coordinates' property, it has 'geometries'
      // So countPointsInGeometry returns 0 for unsupported types
      expect(countPointsInGeometry(geometryCollection as any)).toBe(0);
    });

    it('should count points in geometry with 3D coordinates', () => {
      const point3D: Point = {
        type: 'Point',
        coordinates: [-74.006, 40.7128, 100],
      };
      expect(countPointsInGeometry(point3D)).toBe(1);

      const lineString3D: LineString = {
        type: 'LineString',
        coordinates: [
          [-74.006, 40.7128, 100],
          [-73.9855, 40.758, 200],
          [-73.97, 40.77, 300],
        ],
      };
      expect(countPointsInGeometry(lineString3D)).toBe(3);
    });

    it('should count points in polygon with many holes', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          // Outer ring
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            [-74.01, 40.72],
            [-74.01, 40.71],
          ],
          // Hole 1
          [
            [-74.005, 40.715],
            [-74.002, 40.715],
            [-74.002, 40.717],
            [-74.005, 40.717],
            [-74.005, 40.715],
          ],
          // Hole 2
          [
            [-74.008, 40.712],
            [-74.007, 40.712],
            [-74.007, 40.713],
            [-74.008, 40.713],
            [-74.008, 40.712],
          ],
          // Hole 3
          [
            [-74.003, 40.718],
            [-74.001, 40.718],
            [-74.001, 40.719],
            [-74.003, 40.719],
            [-74.003, 40.718],
          ],
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(20);
    });

    it('should count points in MultiPolygon with many polygons and holes', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          // Polygon 1 with 2 holes: outer ring (5) + hole1 (5) + hole2 (5) = 15
          [
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
            [
              [-74.008, 40.712],
              [-74.007, 40.712],
              [-74.007, 40.713],
              [-74.008, 40.713],
              [-74.008, 40.712],
            ],
          ],
          // Polygon 2 with 1 hole: outer ring (5) + hole (5) = 10
          [
            [
              [-75.0, 40.5],
              [-74.9, 40.5],
              [-74.9, 40.6],
              [-75.0, 40.6],
              [-75.0, 40.5],
            ],
            [
              [-74.95, 40.55],
              [-74.92, 40.55],
              [-74.92, 40.57],
              [-74.95, 40.57],
              [-74.95, 40.55],
            ],
          ],
        ],
      };
      // Total: 15 + 10 = 25
      expect(countPointsInGeometry(multiPolygon)).toBe(25);
    });

    it('should count points in complex nested MultiLineString', () => {
      const multiLineString = {
        type: 'MultiLineString',
        coordinates: [
          [
            [-74.006, 40.7128],
            [-73.9855, 40.758],
            [-73.97, 40.77],
          ],
          [
            [-75.0, 40.5],
            [-74.9, 40.5],
            [-74.8, 40.5],
            [-74.7, 40.5],
          ],
          [
            [-76.0, 40.4],
            [-75.9, 40.4],
          ],
        ],
      };
      expect(countPointsInGeometry(multiLineString)).toBe(9);
    });

    it('should handle geometry with coordinates at antimeridian', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [179, 0],
            [180, 0],
            [-180, 1],
            [-179, 1],
            [179, 0],
          ],
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(5);
    });

    it('should handle geometry with coordinates at poles', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-10, 89],
            [10, 89],
            [10, 90],
            [-10, 90],
            [-10, 89],
          ],
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(5);
    });

    it('should handle geometry with negative coordinates', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-120, -45],
            [-100, -45],
            [-100, -30],
            [-120, -30],
            [-120, -45],
          ],
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(5);
    });

    it('should handle geometry with very small coordinate differences', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.000001, 40.710001],
            [-74.000002, 40.710001],
            [-74.000002, 40.710002],
            [-74.000001, 40.710002],
            [-74.000001, 40.710001],
          ],
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(5);
    });

    it('should handle geometry with many duplicate coordinates', () => {
      const lineString: LineString = {
        type: 'LineString',
        coordinates: [
          [-74.006, 40.7128],
          [-74.006, 40.7128],
          [-74.006, 40.7128],
          [-73.9855, 40.758],
          [-73.9855, 40.758],
          [-73.97, 40.77],
        ],
      };
      expect(countPointsInGeometry(lineString)).toBe(6);
    });

    it('should return 0 for empty GeometryCollection (not supported)', () => {
      const geometryCollection = {
        type: 'GeometryCollection',
        geometries: [],
      };
      // GeometryCollection doesn't have 'coordinates' property
      expect(countPointsInGeometry(geometryCollection as any)).toBe(0);
    });

    it('should handle geometry with single point repeated', () => {
      const multiPoint = {
        type: 'MultiPoint',
        coordinates: Array(100).fill([-74.006, 40.7128]),
      };
      expect(countPointsInGeometry(multiPoint)).toBe(100);
    });

    it('should handle very large polygon with many vertices', () => {
      const polygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          Array.from({ length: 1000 }, (_, i) => [
            -74.0 + Math.cos((i / 1000) * Math.PI * 2) * 0.01,
            40.71 + Math.sin((i / 1000) * Math.PI * 2) * 0.01,
          ]).concat([[-74.0, 40.71]]), // Close the ring
        ],
      };
      expect(countPointsInGeometry(polygon)).toBe(1001);
    });
  });
});
