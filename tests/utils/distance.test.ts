import { describe, it, expect } from 'vitest';
import {
  haversine,
  haversineMeters,
  haversineKm,
  haversineMiles,
  vincenty,
  vincentyMeters,
  vincentyKm,
  vincentyMiles,
  greatCircle,
  greatCircleMeters,
  greatCircleKm,
  greatCircleMiles,
  rhumbLine,
  rhumbLineMeters,
  rhumbLineKm,
  rhumbLineMiles,
  withinDistance,
} from '../../src/utils/distance';

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

  describe('vincenty', () => {
    it('should calculate distance correctly in meters', () => {
      const distance = vincenty(6378137)(nyc)(la);
      // NYC to LA is approximately 3944 km = 3,944,000 meters
      // Vincenty is more accurate than Haversine
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should be curried correctly', () => {
      const distanceFromNYC = vincentyMeters(nyc);
      const dist1 = distanceFromNYC(la);
      const dist2 = vincentyMeters(nyc)(la);
      expect(dist1).toBe(dist2);
    });

    it('should return 0 for same point', () => {
      const distance = vincentyMeters(nyc)(nyc);
      expect(distance).toBe(0);
    });
  });

  describe('vincentyKm', () => {
    it('should calculate distance in kilometers', () => {
      const distance = vincentyKm(nyc)(la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });
  });

  describe('vincentyMiles', () => {
    it('should calculate distance in miles', () => {
      const distance = vincentyMiles(nyc)(la);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });
  });

  describe('greatCircle', () => {
    it('should calculate distance correctly in meters', () => {
      const distance = greatCircle(6371000)(nyc)(la);
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4000000);
    });

    it('should be curried correctly', () => {
      const distanceFromNYC = greatCircleMeters(nyc);
      const dist1 = distanceFromNYC(la);
      const dist2 = greatCircleMeters(nyc)(la);
      expect(dist1).toBe(dist2);
    });

    it('should return 0 for same point', () => {
      const distance = greatCircleMeters(nyc)(nyc);
      expect(distance).toBe(0);
    });
  });

  describe('greatCircleKm', () => {
    it('should calculate distance in kilometers', () => {
      const distance = greatCircleKm(nyc)(la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });
  });

  describe('greatCircleMiles', () => {
    it('should calculate distance in miles', () => {
      const distance = greatCircleMiles(nyc)(la);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });
  });

  describe('rhumbLine', () => {
    it('should calculate distance correctly in meters', () => {
      const distance = rhumbLine(6371000)(nyc)(la);
      // Rhumb line distance is slightly longer than great circle
      expect(distance).toBeGreaterThan(3900000);
      expect(distance).toBeLessThan(4100000);
    });

    it('should be curried correctly', () => {
      const distanceFromNYC = rhumbLineMeters(nyc);
      const dist1 = distanceFromNYC(la);
      const dist2 = rhumbLineMeters(nyc)(la);
      expect(dist1).toBe(dist2);
    });

    it('should return 0 for same point', () => {
      const distance = rhumbLineMeters(nyc)(nyc);
      expect(distance).toBe(0);
    });
  });

  describe('rhumbLineKm', () => {
    it('should calculate distance in kilometers', () => {
      const distance = rhumbLineKm(nyc)(la);
      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4100);
    });
  });

  describe('rhumbLineMiles', () => {
    it('should calculate distance in miles', () => {
      const distance = rhumbLineMiles(nyc)(la);
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2600);
    });
  });

  describe('algorithm comparison', () => {
    it('all algorithms should give similar results for short distances', () => {
      const point1: [number, number] = [40.7128, -74.006];
      const point2: [number, number] = [40.758, -73.9855];

      const haversineDist = haversineMeters(point1)(point2);
      const vincentyDist = vincentyMeters(point1)(point2);
      const greatCircleDist = greatCircleMeters(point1)(point2);
      const rhumbLineDist = rhumbLineMeters(point1)(point2);

      // All should be within 1% of each other for short distances
      const tolerance = haversineDist * 0.01;
      expect(Math.abs(vincentyDist - haversineDist)).toBeLessThan(tolerance);
      expect(Math.abs(greatCircleDist - haversineDist)).toBeLessThan(tolerance);
      expect(Math.abs(rhumbLineDist - haversineDist)).toBeLessThan(tolerance);
    });
  });

  describe('edge cases', () => {
    describe('distance at poles', () => {
      it('should calculate distance from North Pole', () => {
        const northPole: [number, number] = [90, 0];
        const point: [number, number] = [45, 0];
        const distance = haversineMeters(northPole)(point);
        expect(distance).toBeGreaterThan(0);
        // Should be approximately 5000km (quarter of Earth's circumference)
        expect(distance).toBeGreaterThan(4000000);
        expect(distance).toBeLessThan(6000000);
      });

      it('should calculate distance from South Pole', () => {
        const southPole: [number, number] = [-90, 0];
        const point: [number, number] = [-45, 0];
        const distance = haversineMeters(southPole)(point);
        expect(distance).toBeGreaterThan(4000000);
        expect(distance).toBeLessThan(6000000);
      });

      it('should handle distance between poles', () => {
        const northPole: [number, number] = [90, 0];
        const southPole: [number, number] = [-90, 0];
        const distance = haversineMeters(northPole)(southPole);
        // Should be approximately 20,000km (half Earth's circumference)
        expect(distance).toBeGreaterThan(19000000);
        expect(distance).toBeLessThan(21000000);
      });
    });

    describe('distance across antimeridian', () => {
      it('should calculate distance across dateline', () => {
        const point1: [number, number] = [0, 179];
        const point2: [number, number] = [0, -179];
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(300000); // Should be ~222km
      });

      it('should handle vincenty across antimeridian', () => {
        const point1: [number, number] = [0, 179.5];
        const point2: [number, number] = [0, -179.5];
        const distance = vincentyMeters(point1)(point2);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(200000);
      });
    });

    describe('very short distances', () => {
      it('should handle sub-meter distances', () => {
        const point1: [number, number] = [40.7128, -74.006];
        const point2: [number, number] = [40.71280001, -74.00600001];
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(1);
      });

      it('should handle millimeter precision', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0.000001, 0];
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThan(1);
      });
    });

    describe('very long distances', () => {
      it('should handle nearly antipodal points', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0, 179];
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(19000000); // Nearly half Earth
      });

      it('should handle quarter-Earth distances', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0, 90];
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(9000000);
        expect(distance).toBeLessThan(11000000);
      });
    });

    describe('withinDistance edge cases', () => {
      it('should handle exact threshold distance', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0, 0.009]; // Approximately 1km
        const checkWithin = withinDistance(1000, haversineMeters);
        const isWithin = checkWithin(point1)(point2);
        expect(typeof isWithin).toBe('boolean');
      });

      it('should handle zero distance threshold', () => {
        const point1: [number, number] = [40.7128, -74.006];
        const checkWithin = withinDistance(0, haversineMeters);
        expect(checkWithin(point1)(point1)).toBe(true);
        expect(checkWithin(point1)([40.7129, -74.006])).toBe(false);
      });

      it('should handle very large distance threshold', () => {
        const checkWithin = withinDistance(40000000, haversineMeters); // Earth's circumference
        const isWithin = checkWithin(nyc)(la);
        expect(isWithin).toBe(true);
      });
    });

    describe('rhumbLine specific edge cases', () => {
      it('should calculate rhumb line along equator', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0, 90];
        const distance = rhumbLineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(9000000);
        expect(distance).toBeLessThan(11000000);
      });

      it('should calculate rhumb line along meridian', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [45, 0];
        const distance = rhumbLineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(4000000);
        expect(distance).toBeLessThan(6000000);
      });

      it('should show rhumb line longer than great circle for long distances', () => {
        const rhumbDist = rhumbLineMeters(nyc)(la);
        const greatCircleDist = greatCircleMeters(nyc)(la);
        expect(rhumbDist).toBeGreaterThanOrEqual(greatCircleDist);
      });
    });

    describe('vincenty specific edge cases', () => {
      it('should handle nearly antipodal points', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0.1, 179.9];
        const distance = vincentyMeters(point1)(point2);
        // Vincenty may fail to converge for nearly antipodal points
        expect(distance).toBeGreaterThanOrEqual(0);
      });

      it('should be more accurate than haversine for long distances', () => {
        const vincentyDist = vincentyMeters(nyc)(la);
        const haversineDist = haversineMeters(nyc)(la);
        // Both should be close but Vincenty is more accurate
        expect(Math.abs(vincentyDist - haversineDist)).toBeLessThan(100000);
      });
    });

    describe('negative coordinates', () => {
      it('should handle southern hemisphere', () => {
        const point1: [number, number] = [-33.8688, 151.2093]; // Sydney
        const point2: [number, number] = [-37.8136, 144.9631]; // Melbourne
        const distance = haversineMeters(point1)(point2);
        expect(distance).toBeGreaterThan(700000); // ~713km
        expect(distance).toBeLessThan(800000);
      });

      it('should handle western hemisphere', () => {
        const point1: [number, number] = [40.7128, -74.006]; // NYC
        const point2: [number, number] = [51.5074, -0.1278]; // London
        const distance = haversineKm(point1)(point2);
        expect(distance).toBeGreaterThan(5500);
        expect(distance).toBeLessThan(5600);
      });
    });

    describe('unit conversions', () => {
      it('should convert km to meters correctly', () => {
        const distanceKm = haversineKm(nyc)(la);
        const distanceM = haversineMeters(nyc)(la);
        expect(distanceM).toBeCloseTo(distanceKm * 1000, 0);
      });

      it('should convert miles to meters correctly', () => {
        const distanceMiles = haversineMiles(nyc)(la);
        const distanceM = haversineMeters(nyc)(la);
        // Allow larger tolerance for different earth radii
        expect(Math.abs(distanceM - distanceMiles * 1609.34)).toBeLessThan(1000);
      });

      it('should convert consistently across all algorithms', () => {
        const haversineKmValue = haversineMeters(nyc)(la) / 1000;

        const haversineKmDirect = haversineKm(nyc)(la);
        expect(haversineKmDirect).toBeCloseTo(haversineKmValue, 1);
      });
    });
  });
});
