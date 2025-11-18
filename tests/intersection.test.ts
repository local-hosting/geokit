import { describe, it, expect } from 'vitest';
import { lineIntersection, linesIntersect } from '../src/intersection';
import type { LineSegment } from '../src/intersection';

describe('intersection', () => {
  describe('lineIntersection', () => {
    it('should find intersection of crossing lines', () => {
      const line1: LineSegment = [
        [0, 0],
        [2, 2],
      ];
      const line2: LineSegment = [
        [0, 2],
        [2, 0],
      ];

      const intersection = lineIntersection(line1)(line2);
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(1, 5);
      expect(intersection![1]).toBeCloseTo(1, 5);
    });

    it('should return null for parallel lines', () => {
      const line1: LineSegment = [
        [0, 0],
        [1, 1],
      ];
      const line2: LineSegment = [
        [0, 1],
        [1, 2],
      ];

      expect(lineIntersection(line1)(line2)).toBeNull();
    });

    it('should return null for non-intersecting segments', () => {
      const line1: LineSegment = [
        [0, 0],
        [1, 0],
      ];
      const line2: LineSegment = [
        [2, 0],
        [3, 0],
      ];

      expect(lineIntersection(line1)(line2)).toBeNull();
    });

    it('should handle vertical and horizontal lines', () => {
      const vertical: LineSegment = [
        [1, 0],
        [1, 4],
      ];
      const horizontal: LineSegment = [
        [0, 2],
        [4, 2],
      ];

      const intersection = lineIntersection(vertical)(horizontal);
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(1, 5);
      expect(intersection![1]).toBeCloseTo(2, 5);
    });

    it('should work with NYC coordinates', () => {
      const line1: LineSegment = [
        [40.7, -74.0],
        [40.71, -73.99],
      ];
      const line2: LineSegment = [
        [40.7, -73.99],
        [40.71, -74.0],
      ];

      const intersection = lineIntersection(line1)(line2);
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(40.705, 2);
      expect(intersection![1]).toBeCloseTo(-73.995, 2);
    });

    it('should handle intersection at segment endpoint', () => {
      const line1: LineSegment = [
        [0, 0],
        [2, 2],
      ];
      const line2: LineSegment = [
        [2, 2],
        [4, 0],
      ];

      const intersection = lineIntersection(line1)(line2);
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(2, 5);
      expect(intersection![1]).toBeCloseTo(2, 5);
    });

    it('should return null for segments that would intersect if extended', () => {
      const line1: LineSegment = [
        [0, 0],
        [1, 1],
      ];
      const line2: LineSegment = [
        [2, 0],
        [3, 1],
      ];

      // These are parallel, so they wouldn't intersect even if extended
      expect(lineIntersection(line1)(line2)).toBeNull();
    });

    it('should handle T-intersection', () => {
      const line1: LineSegment = [
        [0, 1],
        [2, 1],
      ];
      const line2: LineSegment = [
        [1, 0],
        [1, 2],
      ];

      const intersection = lineIntersection(line1)(line2);
      expect(intersection).not.toBeNull();
      expect(intersection![0]).toBeCloseTo(1, 5);
      expect(intersection![1]).toBeCloseTo(1, 5);
    });

    it('should handle very small segments', () => {
      const line1: LineSegment = [
        [40.7128, -74.006],
        [40.71281, -74.00601],
      ];
      const line2: LineSegment = [
        [40.7128, -74.00601],
        [40.71281, -74.006],
      ];

      const intersection = lineIntersection(line1)(line2);
      expect(intersection).not.toBeNull();
    });
  });

  describe('linesIntersect', () => {
    it('should return true for intersecting lines', () => {
      const line1: LineSegment = [
        [0, 0],
        [2, 2],
      ];
      const line2: LineSegment = [
        [0, 2],
        [2, 0],
      ];

      expect(linesIntersect(line1)(line2)).toBe(true);
    });

    it('should return false for parallel lines', () => {
      const line1: LineSegment = [
        [0, 0],
        [1, 1],
      ];
      const line2: LineSegment = [
        [0, 1],
        [1, 2],
      ];

      expect(linesIntersect(line1)(line2)).toBe(false);
    });

    it('should return false for non-intersecting segments', () => {
      const line1: LineSegment = [
        [0, 0],
        [1, 0],
      ];
      const line2: LineSegment = [
        [2, 0],
        [3, 0],
      ];

      expect(linesIntersect(line1)(line2)).toBe(false);
    });

    it('should return true for T-intersection', () => {
      const line1: LineSegment = [
        [0, 1],
        [2, 1],
      ];
      const line2: LineSegment = [
        [1, 0],
        [1, 2],
      ];

      expect(linesIntersect(line1)(line2)).toBe(true);
    });
  });
});
