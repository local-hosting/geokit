import { describe, it, expect } from 'vitest';
import { polygonCentroid, pointsCentroid } from '../src/centroid';
import type { Polygon } from '../src/types';

describe('centroid', () => {
  describe('polygonCentroid', () => {
    it('should calculate centroid of a square polygon', () => {
      const square: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.71],
            [-74.01, 40.71],
            [-74.01, 40.7],
          ],
        ],
      };

      const centroid = polygonCentroid(square);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(40.705, 3);
      expect(centroid![1]).toBeCloseTo(-74.005, 3);
    });

    it('should calculate centroid of a triangle', () => {
      const triangle: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [0.5, 1],
            [0, 0],
          ],
        ],
      };

      const centroid = polygonCentroid(triangle);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(0.333333, 2);
      expect(centroid![1]).toBeCloseTo(0.5, 2);
    });

    it('should return null for empty polygon', () => {
      const empty: Polygon = {
        type: 'Polygon',
        coordinates: [],
      };

      expect(polygonCentroid(empty)).toBeNull();
    });

    it('should return null for polygon with too few points', () => {
      const invalid: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
          ],
        ],
      };

      expect(polygonCentroid(invalid)).toBeNull();
    });

    it('should handle degenerate polygon', () => {
      const degenerate: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 0],
            [0, 0],
            [0, 0],
          ],
        ],
      };

      const centroid = polygonCentroid(degenerate);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBe(0);
      expect(centroid![1]).toBe(0);
    });

    it('should calculate centroid of irregular polygon', () => {
      const irregular: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.05, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.75],
            [-74.05, 40.75],
            [-74.05, 40.7],
          ],
        ],
      };

      const centroid = polygonCentroid(irregular);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(40.725, 2);
      expect(centroid![1]).toBeCloseTo(-74.025, 2);
    });
  });

  describe('pointsCentroid', () => {
    it('should calculate centroid of multiple points', () => {
      const points: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
        [40.7354, -73.99575],
      ];

      const centroid = pointsCentroid(points);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(40.73546667, 3);
      expect(centroid![1]).toBeCloseTo(-73.99575, 3);
    });

    it('should return null for empty array', () => {
      expect(pointsCentroid([])).toBeNull();
    });

    it('should return same point for single point', () => {
      const point: [number, number] = [40.7128, -74.006];
      const centroid = pointsCentroid([point]);

      expect(centroid).toEqual(point);
    });

    it('should calculate centroid of two points', () => {
      const points: [number, number][] = [
        [0, 0],
        [10, 10],
      ];

      const centroid = pointsCentroid(points);
      expect(centroid).toEqual([5, 5]);
    });

    it('should handle negative coordinates', () => {
      const points: [number, number][] = [
        [-40, -74],
        [-50, -75],
        [-45, -74.5],
      ];

      const centroid = pointsCentroid(points);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(-45, 2);
      expect(centroid![1]).toBeCloseTo(-74.5, 2);
    });

    it('should handle points at poles', () => {
      const points: [number, number][] = [
        [90, 0],
        [89, 0],
        [89.5, 0],
      ];

      const centroid = pointsCentroid(points);
      expect(centroid).not.toBeNull();
      expect(centroid![0]).toBeCloseTo(89.5, 2);
    });
  });
});
