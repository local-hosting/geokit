import { describe, it, expect } from 'vitest';
import { bearing, finalBearing, midpoint, destinationMeters } from '../src/bearing';

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
});
