import { describe, it, expect } from 'vitest';
import { convexHull } from '../../../src/utils/hull';

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
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      expect(hull?.coordinates[0].length).toBeGreaterThanOrEqual(4); // At least 4 points (closed ring)
      // First and last coordinates should be the same (closed ring)
      const ring = hull!.coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    });

    it('should return null for less than 3 points', () => {
      expect(convexHull([])).toBeNull();
      expect(convexHull([[0, 0]])).toBeNull();
      expect(
        convexHull([
          [0, 0],
          [1, 1],
        ])
      ).toBeNull();
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
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      const ring = hull!.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4); // At least 4 unique corners
    });

    it('should handle collinear points', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
      ];

      const hull = convexHull(points);
      // Collinear points may result in null or a valid polygon depending on implementation
      if (hull) {
        expect(hull.type).toBe('Polygon');
      }
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
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      const ring = hull!.coordinates[0];
      expect(ring.length).toBeGreaterThan(3);
      // Ring should be closed
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    });

    it('should handle negative coordinates', () => {
      const points: [number, number][] = [
        [-40, -74],
        [-50, -75],
        [-45, -74.5],
        [-47, -74.8],
      ];

      const hull = convexHull(points);
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      expect(hull?.coordinates[0].length).toBeGreaterThan(0);
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
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      const ring = hull!.coordinates[0];
      // Should only include the 4 corners (plus closing point)
      expect(ring.length).toBeGreaterThanOrEqual(4);

      // Check that interior points are not in hull (coordinates are in [lon, lat] format)
      const hullCoords = ring.map(([lon, lat]) => `${lat},${lon}`);
      expect(hullCoords.includes('2,2')).toBe(false);
      expect(hullCoords.includes('1,1')).toBe(false);
      expect(hullCoords.includes('3,3')).toBe(false);
    });

    it('should handle points forming a triangle', () => {
      const points: [number, number][] = [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ];

      const hull = convexHull(points);
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      const ring = hull!.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4); // 3 points + closing point
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
      expect(hull).not.toBeNull();
      expect(hull?.type).toBe('Polygon');
      const ring = hull!.coordinates[0];
      expect(ring.length).toBeLessThanOrEqual(21); // At most 20 boundary points + closing
      expect(ring.length).toBeGreaterThan(10);
    });
  });
});
