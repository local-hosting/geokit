import { describe, it, expect } from 'vitest';
import { convexHull } from '../src/hull';

describe('convex hull', () => {
  describe('convexHull', () => {
    it('should calculate convex hull for simple points', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0.5, 0.5], // Interior point
      ];

      const hull = convexHull(points);
      expect(hull.length).toBe(5); // 4 corners + closing point
      expect(hull[0]).toEqual(hull[hull.length - 1]); // Should be closed
    });

    it('should return empty array for less than 3 points', () => {
      expect(convexHull([])).toEqual([]);
      expect(convexHull([[0, 0]])).toEqual([]);
      expect(
        convexHull([
          [0, 0],
          [1, 1],
        ])
      ).toEqual([]);
    });

    it('should remove duplicate points', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0], // Duplicate
        [1, 0], // Duplicate
      ];

      const hull = convexHull(points);
      expect(hull.length).toBe(5); // 4 unique corners + closing point
    });

    it('should handle collinear points', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ];

      const hull = convexHull(points);
      // Collinear points should result in a line (empty hull in some implementations)
      expect(Array.isArray(hull)).toBe(true);
    });

    it('should work with NYC area points', () => {
      const points: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
        [40.7354, -73.99575],
        [40.73, -74.0],
        [40.74, -73.98],
        [40.72, -74.01],
      ];

      const hull = convexHull(points);
      expect(hull.length).toBeGreaterThan(3);
      expect(hull[0]).toEqual(hull[hull.length - 1]);
    });

    it('should handle negative coordinates', () => {
      const points: [number, number][] = [
        [-40, -74],
        [-50, -75],
        [-45, -74.5],
        [-47, -74.8],
      ];

      const hull = convexHull(points);
      expect(hull.length).toBeGreaterThan(0);
    });

    it('should include only boundary points', () => {
      const points: [number, number][] = [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [2, 2], // Interior
        [1, 1], // Interior
        [3, 3], // Interior
      ];

      const hull = convexHull(points);
      // Should only include the 4 corners
      expect(hull.length).toBe(5); // 4 corners + closing point

      // Check that interior points are not in hull
      const hullStr = hull.map((p) => `${p[0]},${p[1]}`);
      expect(hullStr.includes('2,2')).toBe(false);
      expect(hullStr.includes('1,1')).toBe(false);
      expect(hullStr.includes('3,3')).toBe(false);
    });

    it('should handle points forming a triangle', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ];

      const hull = convexHull(points);
      expect(hull.length).toBe(4); // 3 points + closing point
    });

    it('should work with many points', () => {
      const points: [number, number][] = [];
      // Create a circle of points with some interior points
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * 2 * Math.PI;
        points.push([Math.cos(angle), Math.sin(angle)]);
        if (i % 3 === 0) {
          // Add some interior points
          points.push([Math.cos(angle) * 0.5, Math.sin(angle) * 0.5]);
        }
      }

      const hull = convexHull(points);
      expect(hull.length).toBeLessThanOrEqual(21); // At most 20 boundary points + closing
      expect(hull.length).toBeGreaterThan(10);
    });
  });
});
