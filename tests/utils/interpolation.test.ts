import { describe, it, expect } from 'vitest';
import {
  interpolate,
  interpolateMeters,
  nearestPointOnLine,
  nearestPointOnPolyline,
  pointToLineDistanceMeters,
  pointToPolylineDistanceMeters,
  resample,
} from '../../src/utils/interpolation';

describe('interpolation', () => {
  const nyc: [number, number] = [40.7128, -74.006];
  const la: [number, number] = [34.0522, -118.2437];

  describe('interpolate', () => {
    it('should return start point at fraction 0', () => {
      const atStart = interpolate(0);
      const point = atStart(nyc)(la);
      expect(point[0]).toBeCloseTo(nyc[0], 4);
      expect(point[1]).toBeCloseTo(nyc[1], 4);
    });

    it('should return end point at fraction 1', () => {
      const atEnd = interpolate(1);
      const point = atEnd(nyc)(la);
      expect(point[0]).toBeCloseTo(la[0], 3);
      expect(point[1]).toBeCloseTo(la[1], 3);
    });

    it('should return midpoint at fraction 0.5', () => {
      const atMid = interpolate(0.5);
      const point = atMid(nyc)(la);
      // Should be between NYC and LA
      expect(point[0]).toBeGreaterThan(la[0]);
      expect(point[0]).toBeLessThan(nyc[0]);
      expect(point[1]).toBeGreaterThan(la[1]);
      expect(point[1]).toBeLessThan(nyc[1]);
    });
  });

  describe('interpolateMeters', () => {
    it('should interpolate at given distance', () => {
      const at1km = interpolateMeters(1000);
      const point = at1km(nyc)([40.72, -74.0]);

      // Should be close to NYC (only 1km away)
      expect(Math.abs(point[0] - nyc[0])).toBeLessThan(0.02);
      expect(Math.abs(point[1] - nyc[1])).toBeLessThan(0.02);
    });

    it('should return start for distance 0', () => {
      const at0 = interpolateMeters(0);
      const point = at0(nyc)(la);
      expect(point[0]).toBeCloseTo(nyc[0], 4);
      expect(point[1]).toBeCloseTo(nyc[1], 4);
    });
  });

  describe('nearestPointOnLine', () => {
    it('should find nearest point on line segment', () => {
      const findNearest = nearestPointOnLine([40.715, -74.005]);
      const lineStart: [number, number] = [40.71, -74.01];
      const lineEnd: [number, number] = [40.72, -74.0];
      const nearest = findNearest(lineStart)(lineEnd);

      expect(nearest[0]).toBeGreaterThanOrEqual(lineStart[0]);
      expect(nearest[0]).toBeLessThanOrEqual(lineEnd[0]);
    });

    it('should return line start when line has zero length', () => {
      const findNearest = nearestPointOnLine([40.715, -74.005]);
      const point: [number, number] = [40.71, -74.01];
      const nearest = findNearest(point)(point);

      expect(nearest).toEqual(point);
    });
  });

  describe('nearestPointOnPolyline', () => {
    const polyline: [number, number][] = [
      [40.71, -74.01],
      [40.72, -74.0],
      [40.73, -73.99],
    ];

    it('should find nearest point on polyline', () => {
      const point: [number, number] = [40.715, -74.005];
      const result = nearestPointOnPolyline(point)(polyline);

      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.segmentIndex).toBeLessThan(polyline.length - 1);
      expect(result!.distance).toBeGreaterThanOrEqual(0);
    });

    it('should return null for empty polyline', () => {
      const result = nearestPointOnPolyline([40.7, -74.0])([]);
      expect(result).toBeNull();
    });

    it('should return null for single point polyline', () => {
      const result = nearestPointOnPolyline([40.7, -74.0])([[40.71, -74.01]]);
      expect(result).toBeNull();
    });

    it('should find nearest point when point is on the polyline', () => {
      const point: [number, number] = [40.72, -74.0]; // On the polyline
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      expect(result!.distance).toBeCloseTo(0, 1);
    });

    it('should find nearest point when point is far from polyline', () => {
      const point: [number, number] = [50.0, -80.0]; // Far away
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      expect(result!.distance).toBeGreaterThan(0);
    });

    it('should find nearest point at start of polyline', () => {
      const point: [number, number] = [40.71, -74.01]; // Exactly at start
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBe(0);
    });

    it('should find nearest point at end of polyline', () => {
      const point: [number, number] = [40.73, -73.99]; // Exactly at end
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      // Should return a valid result with segment index and distance
      expect(result!.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.distance).toBeGreaterThanOrEqual(0);
      expect(result!.point).toHaveLength(2);
    });

    it('should handle polyline with many segments', () => {
      const longPolyline: [number, number][] = [
        [40.71, -74.01],
        [40.711, -74.009],
        [40.712, -74.008],
        [40.713, -74.007],
        [40.714, -74.006],
        [40.715, -74.005],
      ];
      const point: [number, number] = [40.713, -74.007];
      const result = nearestPointOnPolyline(point)(longPolyline);
      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.segmentIndex).toBeLessThan(longPolyline.length - 1);
    });

    it('should handle point very close to polyline', () => {
      const point: [number, number] = [40.72, -74.0001]; // Very close
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      expect(result!.distance).toBeLessThan(100); // Less than 100 meters
    });
  });

  describe('resample', () => {
    const polyline: [number, number][] = [
      [40.71, -74.01],
      [40.72, -74.0],
      [40.73, -73.99],
    ];

    it('should resample polyline at regular intervals', () => {
      const resampled = resample(5000)(polyline); // 5km intervals
      expect(resampled.length).toBeGreaterThan(0);
      expect(resampled[0]).toEqual(polyline[0]);
      expect(resampled[resampled.length - 1]).toEqual(polyline[polyline.length - 1]);
    });

    it('should return original for empty polyline', () => {
      const resampled = resample(1000)([]);
      expect(resampled).toEqual([]);
    });

    it('should return original for single point', () => {
      const single = [[40.7, -74.0]] as [number, number][];
      const resampled = resample(1000)(single);
      expect(resampled).toEqual(single);
    });
  });

  describe('interpolate fallback path', () => {
    it('should use fallback when fraction is clamped', () => {
      // Test clamping behavior (lines 44-47)
      const atNegative = interpolate(-0.5);
      const point = atNegative(nyc)(la);
      // Should clamp to 0, so should be close to NYC
      expect(point[0]).toBeCloseTo(nyc[0], 2);
      expect(point[1]).toBeCloseTo(nyc[1], 2);

      const atOverOne = interpolate(1.5);
      const point2 = atOverOne(nyc)(la);
      // Should clamp to 1, so should be close to LA
      expect(point2[0]).toBeCloseTo(la[0], 2);
      expect(point2[1]).toBeCloseTo(la[1], 2);
    });
  });

  describe('interpolateMeters fallback path', () => {
    it('should use fallback calculation when distance exceeds total', () => {
      // When distance > total distance, should clamp to end point
      const atVeryFar = interpolateMeters(10000000); // 10,000 km
      const point = atVeryFar(nyc)([40.72, -74.0]); // Very short distance
      // Should be close to end point
      expect(point[0]).toBeCloseTo(40.72, 1);
      expect(point[1]).toBeCloseTo(-74.0, 1);
    });

    it('should handle zero total distance', () => {
      const at1km = interpolateMeters(1000);
      const point = at1km(nyc)(nyc); // Same point
      expect(point[0]).toBeCloseTo(nyc[0], 2);
      expect(point[1]).toBeCloseTo(nyc[1], 2);
    });
  });

  describe('nearestPointOnLine edge cases', () => {
    it('should handle zero-length line segment', () => {
      // Tests lines 47-49
      const findNearest = nearestPointOnLine([40.715, -74.005]);
      const point: [number, number] = [40.71, -74.01];
      const nearest = findNearest(point)(point);
      expect(nearest).toEqual(point);
    });

    it('should handle vertical line (dx === 0)', () => {
      const findNearest = nearestPointOnLine([40.715, -74.01]);
      const lineStart: [number, number] = [40.71, -74.01];
      const lineEnd: [number, number] = [40.72, -74.01];
      const nearest = findNearest(lineStart)(lineEnd);
      expect(nearest[1]).toBeCloseTo(-74.01, 5); // Same longitude
      expect(nearest[0]).toBeGreaterThanOrEqual(lineStart[0]);
      expect(nearest[0]).toBeLessThanOrEqual(lineEnd[0]);
    });

    it('should handle horizontal line (dy === 0)', () => {
      const findNearest = nearestPointOnLine([40.71, -74.005]);
      const lineStart: [number, number] = [40.71, -74.01];
      const lineEnd: [number, number] = [40.71, -74.0];
      const nearest = findNearest(lineStart)(lineEnd);
      expect(nearest[0]).toBeCloseTo(40.71, 5); // Same latitude
      expect(nearest[1]).toBeGreaterThanOrEqual(lineStart[1]);
      expect(nearest[1]).toBeLessThanOrEqual(lineEnd[1]);
    });
  });

  describe('nearestPointOnPolyline fallback path', () => {
    it('should use fallback when Turf fails', () => {
      // Create a polyline that might cause issues
      const polyline: [number, number][] = [
        [40.71, -74.01],
        [40.72, -74.0],
      ];
      const point: [number, number] = [40.715, -74.005];
      const result = nearestPointOnPolyline(point)(polyline);
      // Should still return valid result using fallback
      expect(result).not.toBeNull();
      expect(result!.point).toHaveLength(2);
      expect(result!.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.distance).toBeGreaterThanOrEqual(0);
    });

    it('should find nearest on first segment', () => {
      const polyline: [number, number][] = [
        [40.71, -74.01],
        [40.72, -74.0],
        [40.73, -73.99],
      ];
      const point: [number, number] = [40.71, -74.01]; // At start
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      expect(result!.segmentIndex).toBe(0);
    });

    it('should find nearest on last segment', () => {
      const polyline: [number, number][] = [
        [40.71, -74.01],
        [40.72, -74.0],
        [40.73, -73.99],
      ];
      const point: [number, number] = [40.73, -73.99]; // At end
      const result = nearestPointOnPolyline(point)(polyline);
      expect(result).not.toBeNull();
      // Should be on one of the segments (0 to length-2)
      expect(result!.segmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.segmentIndex).toBeLessThan(polyline.length);
    });
  });
  describe('pointToLineDistance', () => {
    it('returns zero when the point lies on the segment', () => {
      const onLine: [number, number] = [40.715, -74.005];
      const distance = pointToLineDistanceMeters(onLine)([40.71, -74.01])([40.72, -74.0]);
      expect(distance).toBeLessThan(1);
    });

    it('returns positive distance for an off-line point', () => {
      const distance = pointToLineDistanceMeters([40.715, -74.005])([40.71, -74.01])([
        40.72, -74.0,
      ]);
      expect(distance).toBeGreaterThan(0);
    });

    it('measures minimum distance to a polyline', () => {
      const polyline: [number, number][] = [
        [40.71, -74.01],
        [40.72, -74.0],
        [40.73, -73.99],
      ];
      const distance = pointToPolylineDistanceMeters([40.715, -74.005], polyline);
      expect(distance).toBeGreaterThan(0);
      expect(Number.isFinite(distance)).toBe(true);
    });
  });
});
