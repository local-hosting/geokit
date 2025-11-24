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
} from '../src/coordinates';

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
  });
});
