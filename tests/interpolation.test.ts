import { describe, it, expect } from 'vitest';
import {
  interpolate,
  interpolateMeters,
  nearestPointOnLine,
  nearestPointOnPolyline,
  resample,
} from '../src/interpolation';

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
});
