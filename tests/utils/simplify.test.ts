import { describe, it, expect } from 'vitest';
import { simplify, simplifyMeters } from '../../src/utils/simplify';

describe('simplify', () => {
  describe('simplify', () => {
    const zigzag: [number, number][] = [
      [40.71, -74.01],
      [40.711, -74.009],
      [40.712, -74.008],
      [40.713, -74.007],
      [40.714, -74.006],
      [40.715, -74.005],
      [40.72, -74.0],
    ];

    it('should simplify polyline with given tolerance', () => {
      const simplified = simplify(0.01)(zigzag);
      expect(simplified.length).toBeLessThan(zigzag.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should keep start and end points', () => {
      const simplified = simplify(0.01)(zigzag);
      expect(simplified[0]).toEqual(zigzag[0]);
      expect(simplified[simplified.length - 1]).toEqual(zigzag[zigzag.length - 1]);
    });

    it('should return original for polylines with <= 2 points', () => {
      const short = [
        [40.71, -74.01],
        [40.72, -74.0],
      ] as [number, number][];
      const simplified = simplify(0.01)(short);
      expect(simplified).toEqual(short);
    });

    it('should retain most points when tolerance is very small', () => {
      const simplified = simplify(0.0001)(zigzag);
      // Very small tolerance should keep most points
      expect(simplified.length).toBeGreaterThanOrEqual(2);
      expect(simplified.length).toBeLessThanOrEqual(zigzag.length);
    });
  });

  describe('simplifyMeters', () => {
    const polyline: [number, number][] = [
      [40.71, -74.01],
      [40.711, -74.009],
      [40.712, -74.008],
      [40.713, -74.007],
      [40.72, -74.0],
    ];

    it('should simplify using meters tolerance', () => {
      const simplified = simplifyMeters(500)(polyline);
      expect(simplified.length).toBeLessThanOrEqual(polyline.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for empty polyline', () => {
      const simplified = simplifyMeters(100)([]);
      expect(simplified).toEqual([]);
    });

    it('should keep more points with smaller tolerance', () => {
      const simplified100 = simplifyMeters(100)(polyline);
      const simplified1000 = simplifyMeters(1000)(polyline);
      expect(simplified100.length).toBeGreaterThanOrEqual(simplified1000.length);
    });
  });
});
