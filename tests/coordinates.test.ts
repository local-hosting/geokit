import { describe, it, expect } from 'vitest';
import {
  toLatLon,
  toLonLat,
  isValidCoordinate,
  extractCoordinates,
  createPoint,
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
});
