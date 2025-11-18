import { describe, it, expect } from 'vitest';
import {
  pointInPolygon,
  isPointInPolygon,
  pointInCircle,
  isPointInCircle,
  boundsContains,
  boundsContainsBounds,
  boundsIntersects,
} from '../src/containment';

describe('containment', () => {
  describe('pointInPolygon', () => {
    const squarePolygon = {
      type: 'Polygon' as const,
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

    it('should return true for point inside polygon', () => {
      const testPoint = pointInPolygon([40.705, -74.005]);
      expect(testPoint(squarePolygon)).toBe(true);
    });

    it('should return false for point outside polygon', () => {
      const testPoint = pointInPolygon([40.5, -74.0]);
      expect(testPoint(squarePolygon)).toBe(false);
    });

    it('should work with non-curried helper', () => {
      const inside = isPointInPolygon([40.705, -74.005], squarePolygon);
      expect(inside).toBe(true);
    });
  });

  describe('pointInCircle', () => {
    const center: [number, number] = [40.7128, -74.006];

    it('should return true for point inside circle', () => {
      const within1km = pointInCircle(1000);
      const checkCenter = within1km(center);
      const nearby: [number, number] = [40.713, -74.0062];
      expect(checkCenter(nearby)).toBe(true);
    });

    it('should return false for point outside circle', () => {
      const within1km = pointInCircle(1000);
      const checkCenter = within1km(center);
      const far: [number, number] = [40.758, -73.9855];
      expect(checkCenter(far)).toBe(false);
    });

    it('should return true for point at center', () => {
      const within1km = pointInCircle(1000);
      const checkCenter = within1km(center);
      expect(checkCenter(center)).toBe(true);
    });

    it('should work with non-curried helper', () => {
      const inside = isPointInCircle([40.713, -74.0062], center, 1000);
      expect(inside).toBe(true);
    });
  });

  describe('boundsContains', () => {
    const bounds: [number, number, number, number] = [-74.1, 40.6, -73.9, 40.8];

    it('should return true for point inside bounds', () => {
      const check = boundsContains(bounds);
      expect(check([40.7, -74.0])).toBe(true);
    });

    it('should return false for point outside bounds', () => {
      const check = boundsContains(bounds);
      expect(check([40.5, -74.0])).toBe(false);
    });

    it('should return true for point on boundary', () => {
      const check = boundsContains(bounds);
      expect(check([40.6, -74.1])).toBe(true);
    });
  });

  describe('boundsContainsBounds', () => {
    const outerBounds: [number, number, number, number] = [-75, 40, -73, 41];
    const innerBounds: [number, number, number, number] = [-74.5, 40.5, -73.5, 40.9];

    it('should return true when inner bounds are contained', () => {
      const check = boundsContainsBounds(outerBounds);
      expect(check(innerBounds)).toBe(true);
    });

    it('should return false when bounds overlap but not contained', () => {
      const check = boundsContainsBounds(outerBounds);
      const overlapping: [number, number, number, number] = [-74, 40.5, -72, 41.5];
      expect(check(overlapping)).toBe(false);
    });
  });

  describe('boundsIntersects', () => {
    const bounds1: [number, number, number, number] = [-74.1, 40.6, -73.9, 40.8];

    it('should return true for intersecting bounds', () => {
      const check = boundsIntersects(bounds1);
      const bounds2: [number, number, number, number] = [-74.0, 40.7, -73.8, 40.9];
      expect(check(bounds2)).toBe(true);
    });

    it('should return false for non-intersecting bounds', () => {
      const check = boundsIntersects(bounds1);
      const bounds2: [number, number, number, number] = [-72, 41, -71, 42];
      expect(check(bounds2)).toBe(false);
    });

    it('should return true for adjacent bounds', () => {
      const check = boundsIntersects(bounds1);
      const bounds2: [number, number, number, number] = [-73.9, 40.6, -73.7, 40.8];
      expect(check(bounds2)).toBe(true);
    });
  });
});
