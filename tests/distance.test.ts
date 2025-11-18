import { describe, it, expect } from 'vitest';
import {
  haversine,
  haversineMeters,
  haversineKm,
  haversineMiles,
  withinDistance,
} from '../src/distance';

describe('distance', () => {
  const nyc: [number, number] = [40.7128, -74.006];
  const la: [number, number] = [34.0522, -118.2437];

  describe('haversine', () => {
    it('should calculate distance correctly in meters', () => {
      const distance = haversine(6371000)(nyc)(la);
      // NYC to LA is approximately 3944 km = 3,944,000 meters
      // Allow 1% tolerance
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should be curried correctly', () => {
      const distanceFromNYC = haversineMeters(nyc);
      const dist1 = distanceFromNYC(la);
      const dist2 = haversineMeters(nyc)(la);
      expect(dist1).toBe(dist2);
    });
  });

  describe('haversineMeters', () => {
    it('should calculate distance in meters', () => {
      const distance = haversineMeters(nyc)(la);
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should return 0 for same point', () => {
      const distance = haversineMeters(nyc)(nyc);
      expect(distance).toBe(0);
    });
  });

  describe('haversineKm', () => {
    it('should calculate distance in kilometers', () => {
      const distance = haversineKm(nyc)(la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });
  });

  describe('haversineMiles', () => {
    it('should calculate distance in miles', () => {
      const distance = haversineMiles(nyc)(la);
      // NYC to LA is approximately 2445 miles
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });
  });

  describe('withinDistance', () => {
    it('should return true when points are within threshold', () => {
      const point1: [number, number] = [40.7128, -74.006];
      const point2: [number, number] = [40.713, -74.0062];
      const checkWithin = withinDistance(1000, haversineMeters); // 1000 meters
      const isWithin = checkWithin(point1)(point2);
      expect(isWithin).toBe(true);
    });

    it('should return false when points are outside threshold', () => {
      const checkWithin = withinDistance(100, haversineMeters); // 100 meters
      const isWithin = checkWithin(nyc)(la);
      expect(isWithin).toBe(false);
    });

    it('should work with curried functions', () => {
      const checkWithin100m = withinDistance(100, haversineMeters);
      const point1: [number, number] = [40.7128, -74.006];
      const point2: [number, number] = [40.7129, -74.0061];
      const isWithin = checkWithin100m(point1)(point2);
      expect(isWithin).toBe(true);
    });
  });
});
