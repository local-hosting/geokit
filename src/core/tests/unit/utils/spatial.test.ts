import { describe, it, expect } from 'vitest';
import {
  isGeohash,
  isH3,
  isGeohashPoint,
  isGeohashArea,
  isH3Point,
  isH3Area,
  getSpatialIndexType,
  asGeohashPoint,
  asGeohashArea,
  asH3Point,
  asH3Area,
} from '../../../src/utils/spatial';
import {
  geohashPointToH3Point,
  geohashAreaToH3Area,
  h3PointToGeohashPoint,
  h3AreaToGeohashArea,
  decodePointToCoordinates,
  decodeAreaToCoordinates,
  getBoundsFromPoint,
  getBoundsFromArea,
} from '../../../src/utils/spatial/decode';
import { encodeGeohashPoint, encodeGeohashArea } from '../../../src/utils/geohash';
import { coordinatesToH3Point, coordinatesToH3Area } from '@doppler-group/geokit/h3';
import {
  serializeCoordinates,
  deserializeCoordinates,
  normalizeCoordinateInput,
  createPoint,
} from '../../../src/utils/coordinates';

describe('spatial', () => {
  const nyc: [number, number] = [40.7128, -74.006];

  describe('Type Guards', () => {
    describe('isGeohash', () => {
      it('should return true for valid geohash', () => {
        expect(isGeohash('dr5regw3p')).toBe(true);
        expect(isGeohash('dr5r')).toBe(true);
        expect(isGeohash('9q5')).toBe(true);
      });

      it('should return false for H3 format', () => {
        expect(isGeohash('892a1072c97ffff')).toBe(false);
      });

      it('should return false for invalid strings', () => {
        expect(isGeohash('')).toBe(false);
        expect(isGeohash('invalid!')).toBe(false);
        expect(isGeohash('aaa')).toBe(false); // 'a' not in geohash charset
      });
    });

    describe('isH3', () => {
      it('should return true for valid H3 index', () => {
        expect(isH3('892a1072c97ffff')).toBe(true);
        expect(isH3('8a2a1072c907fff')).toBe(true);
      });

      it('should return false for geohash format', () => {
        expect(isH3('dr5regw3p')).toBe(false);
      });

      it('should return false for invalid strings', () => {
        expect(isH3('')).toBe(false);
        expect(isH3('invalid')).toBe(false);
        expect(isH3('892a107')).toBe(false); // too short
      });
    });

    describe('isGeohashPoint and isGeohashArea', () => {
      it('should validate geohash format for points', () => {
        expect(isGeohashPoint('dr5regw3p')).toBe(true);
        expect(isGeohashPoint('invalid')).toBe(false);
      });

      it('should validate geohash format for areas', () => {
        expect(isGeohashArea('dr5r')).toBe(true);
        expect(isGeohashArea('invalid')).toBe(false);
      });
    });

    describe('isH3Point and isH3Area', () => {
      it('should validate H3 format for points', () => {
        expect(isH3Point('892a1072c97ffff')).toBe(true);
        expect(isH3Point('invalid')).toBe(false);
      });

      it('should validate H3 format for areas', () => {
        expect(isH3Area('892a1072c97ffff')).toBe(true);
        expect(isH3Area('invalid')).toBe(false);
      });
    });

    describe('getSpatialIndexType', () => {
      it('should identify geohash', () => {
        expect(getSpatialIndexType('dr5regw3p')).toBe('geohash');
      });

      it('should identify H3', () => {
        expect(getSpatialIndexType('892a1072c97ffff')).toBe('h3');
      });

      it('should return unknown for invalid', () => {
        expect(getSpatialIndexType('invalid')).toBe('unknown');
      });
    });
  });

  describe('Branded Type Constructors', () => {
    describe('asGeohashPoint', () => {
      it('should create GeohashPoint from valid string', () => {
        const point = asGeohashPoint('dr5regw3p');
        expect(typeof point).toBe('string');
        expect(point).toBe('dr5regw3p');
      });

      it('should throw for invalid geohash', () => {
        expect(() => asGeohashPoint('invalid!')).toThrow();
      });
    });

    describe('asGeohashArea', () => {
      it('should create GeohashArea from valid string', () => {
        const area = asGeohashArea('dr5r');
        expect(typeof area).toBe('string');
        expect(area).toBe('dr5r');
      });

      it('should throw for invalid geohash', () => {
        expect(() => asGeohashArea('invalid!')).toThrow();
      });
    });

    describe('asH3Point', () => {
      it('should create H3Point from valid string', () => {
        const point = asH3Point('892a1072c97ffff');
        expect(typeof point).toBe('string');
        expect(point).toBe('892a1072c97ffff');
      });

      it('should throw for invalid H3', () => {
        expect(() => asH3Point('invalid')).toThrow();
      });
    });

    describe('asH3Area', () => {
      it('should create H3Area from valid string', () => {
        const area = asH3Area('892a1072c97ffff');
        expect(typeof area).toBe('string');
        expect(area).toBe('892a1072c97ffff');
      });

      it('should throw for invalid H3', () => {
        expect(() => asH3Area('invalid')).toThrow();
      });
    });
  });

  describe('Conversion Functions', () => {
    describe('geohashPointToH3Point', () => {
      it('should convert GeohashPoint to H3Point', () => {
        const geohashPoint = encodeGeohashPoint(9)(nyc);
        const h3Point = geohashPointToH3Point(geohashPoint, 9);

        expect(typeof h3Point).toBe('string');
        expect(isH3(h3Point)).toBe(true);
      });

      it('should preserve approximate location', () => {
        const geohashPoint = encodeGeohashPoint(9)(nyc);
        const h3Point = geohashPointToH3Point(geohashPoint, 9);
        const decoded = decodePointToCoordinates(h3Point);

        // Should be within ~1km of original
        expect(Math.abs(decoded[0] - nyc[0])).toBeLessThan(0.01);
        expect(Math.abs(decoded[1] - nyc[1])).toBeLessThan(0.01);
      });
    });

    describe('geohashAreaToH3Area', () => {
      it('should convert GeohashArea to H3Area', () => {
        const geohashArea = encodeGeohashArea(7)(nyc);
        const h3Area = geohashAreaToH3Area(geohashArea, 7);

        expect(typeof h3Area).toBe('string');
        expect(isH3(h3Area)).toBe(true);
      });
    });

    describe('h3PointToGeohashPoint', () => {
      it('should convert H3Point to GeohashPoint', () => {
        const h3Point = coordinatesToH3Point(9)(nyc);
        const geohashPoint = h3PointToGeohashPoint(h3Point, 9);

        expect(typeof geohashPoint).toBe('string');
        expect(isGeohash(geohashPoint)).toBe(true);
      });

      it('should preserve approximate location', () => {
        const h3Point = coordinatesToH3Point(9)(nyc);
        const geohashPoint = h3PointToGeohashPoint(h3Point, 9);
        const decoded = decodePointToCoordinates(geohashPoint);

        // Should be within ~1km of original
        expect(Math.abs(decoded[0] - nyc[0])).toBeLessThan(0.01);
        expect(Math.abs(decoded[1] - nyc[1])).toBeLessThan(0.01);
      });
    });

    describe('h3AreaToGeohashArea', () => {
      it('should convert H3Area to GeohashArea', () => {
        const h3Area = coordinatesToH3Area(7)(nyc);
        const geohashArea = h3AreaToGeohashArea(h3Area, 7);

        expect(typeof geohashArea).toBe('string');
        expect(isGeohash(geohashArea)).toBe(true);
      });
    });

    describe('roundtrip conversions', () => {
      it('should roundtrip GeohashPoint -> H3Point -> GeohashPoint', () => {
        const original = encodeGeohashPoint(9)(nyc);
        const h3 = geohashPointToH3Point(original, 9);
        const back = h3PointToGeohashPoint(h3, 9);

        const originalCoords = decodePointToCoordinates(original);
        const backCoords = decodePointToCoordinates(back);

        expect(Math.abs(originalCoords[0] - backCoords[0])).toBeLessThan(0.01);
        expect(Math.abs(originalCoords[1] - backCoords[1])).toBeLessThan(0.01);
      });

      it('should roundtrip H3Point -> GeohashPoint -> H3Point', () => {
        const original = coordinatesToH3Point(9)(nyc);
        const geohash = h3PointToGeohashPoint(original, 9);
        const back = geohashPointToH3Point(geohash, 9);

        const originalCoords = decodePointToCoordinates(original);
        const backCoords = decodePointToCoordinates(back);

        expect(Math.abs(originalCoords[0] - backCoords[0])).toBeLessThan(0.01);
        expect(Math.abs(originalCoords[1] - backCoords[1])).toBeLessThan(0.01);
      });
    });
  });

  describe('Universal Functions', () => {
    describe('decodePointToCoordinates', () => {
      it('should decode GeohashPoint', () => {
        const geohashPoint = encodeGeohashPoint(9)(nyc);
        const coords = decodePointToCoordinates(geohashPoint);

        expect(coords).toHaveLength(2);
        expect(coords[0]).toBeCloseTo(nyc[0], 3);
        expect(coords[1]).toBeCloseTo(nyc[1], 3);
      });

      it('should decode H3Point', () => {
        const h3Point = coordinatesToH3Point(9)(nyc);
        const coords = decodePointToCoordinates(h3Point);

        expect(coords).toHaveLength(2);
        expect(coords[0]).toBeCloseTo(nyc[0], 2);
        expect(coords[1]).toBeCloseTo(nyc[1], 2);
      });
    });

    describe('decodeAreaToCoordinates', () => {
      it('should decode GeohashArea', () => {
        const geohashArea = encodeGeohashArea(7)(nyc);
        const coords = decodeAreaToCoordinates(geohashArea);

        expect(coords).toHaveLength(2);
        expect(coords[0]).toBeCloseTo(nyc[0], 1);
        expect(coords[1]).toBeCloseTo(nyc[1], 1);
      });

      it('should decode H3Area', () => {
        const h3Area = coordinatesToH3Area(7)(nyc);
        const coords = decodeAreaToCoordinates(h3Area);

        expect(coords).toHaveLength(2);
        expect(coords[0]).toBeCloseTo(nyc[0], 1);
        expect(coords[1]).toBeCloseTo(nyc[1], 1);
      });
    });

    describe('getBoundsFromPoint', () => {
      it('should get bounds from GeohashPoint', () => {
        const geohashPoint = encodeGeohashPoint(9)(nyc);
        const bounds = getBoundsFromPoint(geohashPoint);

        expect(bounds).toHaveLength(4);
        expect(bounds[0]).toBeLessThan(bounds[2]); // minLon < maxLon
        expect(bounds[1]).toBeLessThan(bounds[3]); // minLat < maxLat
      });

      it('should get bounds from H3Point', () => {
        const h3Point = coordinatesToH3Point(9)(nyc);
        const bounds = getBoundsFromPoint(h3Point);

        expect(bounds).toHaveLength(4);
        expect(bounds[0]).toBeLessThan(bounds[2]); // minLon < maxLon
        expect(bounds[1]).toBeLessThan(bounds[3]); // minLat < maxLat
      });
    });

    describe('getBoundsFromArea', () => {
      it('should get bounds from GeohashArea', () => {
        const geohashArea = encodeGeohashArea(7)(nyc);
        const bounds = getBoundsFromArea(geohashArea);

        expect(bounds).toHaveLength(4);
        expect(bounds[0]).toBeLessThan(bounds[2]); // minLon < maxLon
        expect(bounds[1]).toBeLessThan(bounds[3]); // minLat < maxLat
      });

      it('should get bounds from H3Area', () => {
        const h3Area = coordinatesToH3Area(7)(nyc);
        const bounds = getBoundsFromArea(h3Area);

        expect(bounds).toHaveLength(4);
        expect(bounds[0]).toBeLessThan(bounds[2]); // minLon < maxLon
        expect(bounds[1]).toBeLessThan(bounds[3]); // minLat < maxLat
      });
    });
  });

  describe('Type Safety', () => {
    it('should maintain type distinction between point and area', () => {
      const geohashPoint = encodeGeohashPoint(9)(nyc);
      const geohashArea = encodeGeohashArea(7)(nyc);

      // These are both strings at runtime
      expect(typeof geohashPoint).toBe('string');
      expect(typeof geohashArea).toBe('string');

      // But TypeScript should catch if we try to pass one where the other is expected
      // (This is compile-time only, but we can verify they work correctly at runtime)
      expect(decodePointToCoordinates(geohashPoint)).toBeTruthy();
      expect(decodeAreaToCoordinates(geohashArea)).toBeTruthy();
    });

    it('should maintain type distinction between Geohash and H3', () => {
      const geohashPoint = encodeGeohashPoint(9)(nyc);
      const h3Point = coordinatesToH3Point(9)(nyc);

      // Runtime values are different formats
      expect(isGeohash(geohashPoint)).toBe(true);
      expect(isH3(h3Point)).toBe(true);
      expect(isGeohash(h3Point)).toBe(false);
      expect(isH3(geohashPoint)).toBe(false);
    });
  });

  describe('Comprehensive Cross-Format Conversions', () => {
    it('should convert between all coordinate formats', () => {
      const original: [number, number] = [40.7128, -74.006];

      // LatLng → Object formats
      const objLatLon = { lat: original[0], lon: original[1] };
      const objLatitudeLongitude = { latitude: original[0], longitude: original[1] };

      // LatLng → JSON
      const json = JSON.stringify(objLatLon);

      // LatLng → GeoJSON Point
      const point = {
        type: 'Point' as const,
        coordinates: [original[1], original[0]] as [number, number],
      };

      // Verify all formats normalize back to LatLng
      expect(normalizeCoordinateInput(original)).toEqual(original);
      expect(normalizeCoordinateInput(objLatLon)).toEqual(original);
      expect(normalizeCoordinateInput(objLatitudeLongitude)).toEqual(original);
      expect(normalizeCoordinateInput(point)).toEqual(original);

      // Verify JSON roundtrip
      const deserialized = deserializeCoordinates(json);
      expect(deserialized).toEqual(original);
    });

    it('should convert LatLng → Geohash → H3 → LatLng', () => {
      const original: [number, number] = [40.7128, -74.006];

      // LatLng → GeohashPoint
      const geohashPoint = encodeGeohashPoint(9)(original);
      expect(isGeohash(geohashPoint)).toBe(true);

      // GeohashPoint → H3Point
      const h3Point = geohashPointToH3Point(geohashPoint, 9);
      expect(isH3(h3Point)).toBe(true);

      // H3Point → LatLng
      const result = decodePointToCoordinates(h3Point);
      expect(result[0]).toBeCloseTo(original[0], 2);
      expect(result[1]).toBeCloseTo(original[1], 2);
    });

    it('should convert LatLng → H3 → Geohash → LatLng', () => {
      const original: [number, number] = [40.7128, -74.006];

      // LatLng → H3Point
      const h3Point = coordinatesToH3Point(9)(original);
      expect(isH3(h3Point)).toBe(true);

      // H3Point → GeohashPoint
      const geohashPoint = h3PointToGeohashPoint(h3Point, 9);
      expect(isGeohash(geohashPoint)).toBe(true);

      // GeohashPoint → LatLng
      const result = decodePointToCoordinates(geohashPoint);
      expect(result[0]).toBeCloseTo(original[0], 2);
      expect(result[1]).toBeCloseTo(original[1], 2);
    });

    it('should convert Object → LatLng → Geohash → H3 → JSON', () => {
      const original = { latitude: 40.7128, longitude: -74.006 };

      // Object → LatLng
      const latLng = normalizeCoordinateInput(original);
      expect(latLng).toEqual([40.7128, -74.006]);

      // LatLng → GeohashPoint
      const geohashPoint = encodeGeohashPoint(9)(latLng!);

      // GeohashPoint → H3Point
      const h3Point = geohashPointToH3Point(geohashPoint, 9);

      // H3Point → LatLng
      const coords = decodePointToCoordinates(h3Point);

      // LatLng → JSON
      const json = serializeCoordinates(coords);
      const deserialized = deserializeCoordinates(json);

      // Verify approximate location preserved
      expect(deserialized![0]).toBeCloseTo(original.latitude, 2);
      expect(deserialized![1]).toBeCloseTo(original.longitude, 2);
    });

    it('should convert JSON → Object → GeoJSON → Geohash → H3', () => {
      const json = '{"lat":40.7128,"lon":-74.006}';

      // JSON → LatLng
      const latLng = deserializeCoordinates(json);
      expect(latLng).toBeTruthy();

      // LatLng → Object
      const obj = { lat: latLng![0], lon: latLng![1] };

      // Object → LatLng (via normalize)
      const normalized = normalizeCoordinateInput(obj);
      expect(normalized).toEqual(latLng);

      // LatLng → GeoJSON Point
      const point = createPoint(normalized!);
      expect(point.type).toBe('Point');
      expect(point.coordinates).toEqual([latLng![1], latLng![0]]);

      // GeoJSON → LatLng → GeohashPoint
      const backToLatLng = normalizeCoordinateInput(point);
      const geohashPoint = encodeGeohashPoint(9)(backToLatLng!);
      expect(isGeohash(geohashPoint)).toBe(true);

      // GeohashPoint → H3Point
      const h3Point = geohashPointToH3Point(geohashPoint, 9);
      expect(isH3(h3Point)).toBe(true);

      // Verify location preserved
      const finalCoords = decodePointToCoordinates(h3Point);
      expect(finalCoords[0]).toBeCloseTo(latLng![0], 2);
      expect(finalCoords[1]).toBeCloseTo(latLng![1], 2);
    });

    it('should handle all formats for area conversions', () => {
      const original: [number, number] = [40.7128, -74.006];

      // LatLng → GeohashArea
      const geohashArea = encodeGeohashArea(7)(original);
      expect(isGeohash(geohashArea)).toBe(true);

      // GeohashArea → H3Area
      const h3Area = geohashAreaToH3Area(geohashArea, 7);
      expect(isH3(h3Area)).toBe(true);

      // H3Area → LatLng
      const coords = decodeAreaToCoordinates(h3Area);
      expect(coords[0]).toBeCloseTo(original[0], 1);
      expect(coords[1]).toBeCloseTo(original[1], 1);

      // LatLng → JSON
      const json = serializeCoordinates(coords);

      // JSON → LatLng
      const deserialized = deserializeCoordinates(json);
      expect(deserialized![0]).toBeCloseTo(original[0], 1);
      expect(deserialized![1]).toBeCloseTo(original[1], 1);
    });
  });
});
