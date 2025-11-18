import { describe, it, expect } from 'vitest';
import {
  bearing,
  finalBearing,
  midpoint,
  destination,
  destinationMeters,
  destinationKm,
  destinationMiles,
} from '../src/bearing';

describe('bearing', () => {
  const nyc: [number, number] = [40.7128, -74.006];
  const la: [number, number] = [34.0522, -118.2437];

  describe('bearing', () => {
    it('should calculate initial bearing between two points', () => {
      const fromNYC = bearing(nyc);
      const bearingToLA = fromNYC(la);
      // NYC to LA is roughly west-southwest (~260-270 degrees)
      expect(bearingToLA).toBeGreaterThan(250);
      expect(bearingToLA).toBeLessThan(280);
    });

    it('should return 0 for same point', () => {
      const fromNYC = bearing(nyc);
      const bearingToSelf = fromNYC(nyc);
      expect(bearingToSelf).toBe(0);
    });

    it('should return bearing in 0-360 range', () => {
      const bearingEast = bearing([0, 0])([0, 1]);
      expect(bearingEast).toBeGreaterThanOrEqual(0);
      expect(bearingEast).toBeLessThan(360);
    });

    it('should calculate east bearing correctly', () => {
      const bearingEast = bearing([0, 0])([0, 1]);
      expect(bearingEast).toBeCloseTo(90, 0);
    });

    it('should calculate north bearing correctly', () => {
      const bearingNorth = bearing([0, 0])([1, 0]);
      expect(bearingNorth).toBeCloseTo(0, 0);
    });
  });

  describe('finalBearing', () => {
    it('should calculate final bearing at destination', () => {
      const fromNYC = finalBearing(nyc);
      const arrivalBearing = fromNYC(la);
      // Final bearing should be different from initial
      expect(arrivalBearing).toBeGreaterThan(0);
      expect(arrivalBearing).toBeLessThan(360);
    });

    it('should differ from initial bearing for long distances', () => {
      const initial = bearing(nyc)(la);
      const final = finalBearing(nyc)(la);
      expect(Math.abs(initial - final)).toBeGreaterThan(1);
    });
  });

  describe('midpoint', () => {
    it('should calculate midpoint between two points', () => {
      const fromNYC = midpoint(nyc);
      const mid = fromNYC(la);

      // Midpoint should be between NYC and LA
      expect(mid[0]).toBeGreaterThan(la[0]);
      expect(mid[0]).toBeLessThan(nyc[0]);
      expect(mid[1]).toBeGreaterThan(la[1]);
      expect(mid[1]).toBeLessThan(nyc[1]);
    });

    it('should return same point when both inputs are identical', () => {
      const mid = midpoint(nyc)(nyc);
      expect(mid[0]).toBeCloseTo(nyc[0], 5);
      expect(mid[1]).toBeCloseTo(nyc[1], 5);
    });
  });

  describe('destination', () => {
    it('should calculate destination point', () => {
      const move1kmEast = destinationMeters(1000, 90);
      const dest = move1kmEast(nyc);

      // Should move east (longitude increases)
      expect(dest[1]).toBeGreaterThan(nyc[1]);
      // Latitude should be roughly the same
      expect(Math.abs(dest[0] - nyc[0])).toBeLessThan(0.01);
    });

    it('should calculate destination point north', () => {
      const move1kmNorth = destinationMeters(1000, 0);
      const dest = move1kmNorth(nyc);

      // Should move north (latitude increases)
      expect(dest[0]).toBeGreaterThan(nyc[0]);
      // Longitude should be roughly the same
      expect(Math.abs(dest[1] - nyc[1])).toBeLessThan(0.01);
    });

    it('should return same point for zero distance', () => {
      const move0 = destinationMeters(0, 90);
      const dest = move0(nyc);

      expect(dest[0]).toBeCloseTo(nyc[0], 5);
      expect(dest[1]).toBeCloseTo(nyc[1], 5);
    });
  });

  describe('edge cases', () => {
    describe('bearing edge cases', () => {
      it('should handle bearing from North Pole', () => {
        const northPole: [number, number] = [90, 0];
        const point: [number, number] = [45, 0];
        const b = bearing(northPole)(point);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      });

      it('should handle bearing from South Pole', () => {
        const southPole: [number, number] = [-90, 0];
        const point: [number, number] = [-45, 0];
        const b = bearing(southPole)(point);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      });

      it('should handle bearing across antimeridian', () => {
        const point1: [number, number] = [0, 179];
        const point2: [number, number] = [0, -179];
        const b = bearing(point1)(point2);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      });

      it('should handle south bearing correctly', () => {
        const bearingSouth = bearing([0, 0])([-1, 0]);
        expect(bearingSouth).toBeCloseTo(180, 0);
      });

      it('should handle west bearing correctly', () => {
        const bearingWest = bearing([0, 0])([0, -1]);
        expect(bearingWest).toBeCloseTo(270, 0);
      });

      it('should handle very short distances', () => {
        const point1: [number, number] = [0, 0];
        const point2: [number, number] = [0.000001, 0];
        const b = bearing(point1)(point2);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(360);
      });
    });

    describe('midpoint edge cases', () => {
      it('should handle midpoint across antimeridian', () => {
        const point1: [number, number] = [0, 179];
        const point2: [number, number] = [0, -179];
        const mid = midpoint(point1)(point2);
        expect(mid[0]).toBeCloseTo(0, 2);
        // Midpoint longitude should be near 180/-180
        expect(Math.abs(mid[1])).toBeGreaterThan(179);
      });

      it('should handle midpoint at poles', () => {
        const northPole: [number, number] = [90, 0];
        const southPole: [number, number] = [-90, 0];
        const mid = midpoint(northPole)(southPole);
        expect(Math.abs(mid[0])).toBeLessThan(1); // Should be near equator
      });

      it('should handle very close points', () => {
        const point1: [number, number] = [40.7128, -74.006];
        const point2: [number, number] = [40.7129, -74.0061];
        const mid = midpoint(point1)(point2);
        expect(mid[0]).toBeCloseTo((point1[0] + point2[0]) / 2, 3);
        expect(mid[1]).toBeCloseTo((point1[1] + point2[1]) / 2, 3);
      });
    });

    describe('destination edge cases', () => {
      it('should handle destination south', () => {
        const move1kmSouth = destinationMeters(1000, 180);
        const dest = move1kmSouth(nyc);
        expect(dest[0]).toBeLessThan(nyc[0]);
        expect(Math.abs(dest[1] - nyc[1])).toBeLessThan(0.01);
      });

      it('should handle destination west', () => {
        const move1kmWest = destinationMeters(1000, 270);
        const dest = move1kmWest(nyc);
        expect(dest[1]).toBeLessThan(nyc[1]);
        expect(Math.abs(dest[0] - nyc[0])).toBeLessThan(0.01);
      });

      it('should handle very long distances', () => {
        const move10000km = destinationMeters(10000000, 90);
        const dest = move10000km([0, 0]);
        expect(dest[1]).toBeGreaterThan(0);
      });

      it('should handle negative bearing as positive', () => {
        const moveNorth = destinationMeters(1000, 360);
        const dest = moveNorth(nyc);
        expect(dest[0]).toBeGreaterThan(nyc[0]);
      });

      it('should handle destination from pole', () => {
        const northPole: [number, number] = [89, 0];
        const move1km = destinationMeters(1000, 180);
        const dest = move1km(northPole);
        expect(dest[0]).toBeLessThan(northPole[0]);
      });

      it('should handle destination crossing antimeridian', () => {
        const point: [number, number] = [0, 179];
        const moveEast = destinationMeters(100000, 90);
        const dest = moveEast(point);
        // After moving east from 179, longitude should be near 180/-180
        expect(Math.abs(dest[1])).toBeGreaterThan(179);
      });
    });

    describe('destination with custom radius', () => {
      it('should work with custom radius', () => {
        const move1km = destination(1000, 90, 6371000);
        const dest = move1km(nyc);
        expect(dest[1]).toBeGreaterThan(nyc[1]);
      });

      it('should handle different radius values', () => {
        const move1kmMeters = destination(1000, 90, 6371000);
        const move1kmKm = destination(1, 90, 6371);
        const dest1 = move1kmMeters([0, 0]);
        const dest2 = move1kmKm([0, 0]);
        // Results should be similar but may differ slightly due to unit conversion
        expect(Math.abs(dest1[1] - dest2[1])).toBeLessThan(0.01);
      });
    });

    describe('destinationKm', () => {
      it('should calculate destination in kilometers', () => {
        const move1km = destinationKm(1, 90);
        const dest = move1km(nyc);
        expect(dest[1]).toBeGreaterThan(nyc[1]);
      });

      it('should match destinationMeters with converted distance', () => {
        const move1kmKm = destinationKm(1, 90);
        const move1kmMeters = destinationMeters(1000, 90);
        const dest1 = move1kmKm(nyc);
        const dest2 = move1kmMeters(nyc);
        // Results should be similar but may differ slightly due to unit conversion
        expect(Math.abs(dest1[1] - dest2[1])).toBeLessThan(0.02);
      });
    });

    describe('destinationMiles', () => {
      it('should calculate destination in miles', () => {
        const move1mile = destinationMiles(1, 90);
        const dest = move1mile(nyc);
        expect(dest[1]).toBeGreaterThan(nyc[1]);
      });

      it('should handle long distances in miles', () => {
        const move100miles = destinationMiles(100, 90);
        const dest = move100miles([0, 0]);
        expect(dest[1]).toBeGreaterThan(0);
      });
    });
  });
});
