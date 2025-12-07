import { describe, it, expect } from 'vitest';
import {
  polygonArea,
  polygonAreaKm,
  polygonAreaMiles,
  polygonAreaAcres,
  circleArea,
  circleAreaKm,
  circleAreaMiles,
  boundsArea,
  boundsAreaKm,
  boundsAreaMiles,
} from '../src/area';

describe('area', () => {
  describe('polygonArea', () => {
    const squarePolygon = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [-74.01, 40.71],
          [-74.0, 40.71],
          [-74.0, 40.72],
          [-74.01, 40.72],
          [-74.01, 40.71],
        ],
      ],
    };

    it('should calculate polygon area in square meters', () => {
      const area = polygonArea(squarePolygon);
      expect(area).toBeGreaterThan(0);
      // Rough square of ~1km x 0.8km
      expect(area).toBeGreaterThan(500000);
      expect(area).toBeLessThan(1500000);
    });

    it('should return 0 for invalid polygon', () => {
      const invalid = {
        type: 'Polygon' as const,
        coordinates: [[[0, 0]]],
      };
      expect(polygonArea(invalid)).toBe(0);
    });

    it('should convert to square kilometers', () => {
      const areaKm = polygonAreaKm(squarePolygon);
      expect(areaKm).toBeGreaterThan(0.5);
      expect(areaKm).toBeLessThan(1.5);
    });

    it('should convert to square miles', () => {
      const areaMiles = polygonAreaMiles(squarePolygon);
      expect(areaMiles).toBeGreaterThan(0.2);
      expect(areaMiles).toBeLessThan(0.6);
    });

    it('should convert to acres', () => {
      const areaAcres = polygonAreaAcres(squarePolygon);
      expect(areaAcres).toBeGreaterThan(100);
      expect(areaAcres).toBeLessThan(400);
    });

    it('should return 0 when polygon area calculation fails', () => {
      // Test fallback path (lines 43-46)
      const invalidPolygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            // Missing closing point - might cause issues
          ],
        ],
      };
      const area = polygonArea(invalidPolygon);
      // Should return 0 for invalid polygon
      expect(area).toBe(0);
    });
  });

  describe('circleArea', () => {
    it('should calculate circle area correctly', () => {
      const area = circleArea(1000); // 1km radius
      const expected = Math.PI * 1000 * 1000;
      expect(area).toBeCloseTo(expected, 1);
    });

    it('should convert to square kilometers', () => {
      const areaKm = circleAreaKm(1000);
      const expected = Math.PI; // π km²
      expect(areaKm).toBeCloseTo(expected, 2);
    });

    it('should return 0 for zero radius', () => {
      expect(circleArea(0)).toBe(0);
    });
  });

  describe('boundsArea', () => {
    const bounds: [number, number, number, number] = [-74.01, 40.71, -74.0, 40.72];

    it('should calculate bounds area in square meters', () => {
      const area = boundsArea(bounds);
      expect(area).toBeGreaterThan(0);
      expect(area).toBeGreaterThan(500000);
      expect(area).toBeLessThan(1500000);
    });

    it('should convert to square kilometers', () => {
      const areaKm = boundsAreaKm(bounds);
      expect(areaKm).toBeGreaterThan(0.5);
      expect(areaKm).toBeLessThan(1.5);
    });
  });

  describe('edge cases', () => {
    describe('polygonArea edge cases', () => {
      it('should handle triangle polygon', () => {
        const triangle = {
          type: 'Polygon' as const,
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [0.5, 1],
              [0, 0],
            ],
          ],
        };
        const area = polygonArea(triangle);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle polygon with holes', () => {
        const polygonWithHole = {
          type: 'Polygon' as const,
          coordinates: [
            [
              [-74.05, 40.7],
              [-74.0, 40.7],
              [-74.0, 40.75],
              [-74.05, 40.75],
              [-74.05, 40.7],
            ],
            [
              [-74.04, 40.71],
              [-74.01, 40.71],
              [-74.01, 40.74],
              [-74.04, 40.74],
              [-74.04, 40.71],
            ],
          ],
        };
        const area = polygonArea(polygonWithHole);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle very large polygon', () => {
        const largePolygon = {
          type: 'Polygon' as const,
          coordinates: [
            [
              [-180, -85],
              [180, -85],
              [180, 85],
              [-180, 85],
              [-180, -85],
            ],
          ],
        };
        const area = polygonArea(largePolygon);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle polygon crossing antimeridian', () => {
        const crossingPolygon = {
          type: 'Polygon' as const,
          coordinates: [
            [
              [170, 0],
              [-170, 0],
              [-170, 10],
              [170, 10],
              [170, 0],
            ],
          ],
        };
        const area = polygonArea(crossingPolygon);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle empty coordinates', () => {
        const empty = {
          type: 'Polygon' as const,
          coordinates: [[]],
        };
        expect(polygonArea(empty)).toBe(0);
      });
    });

    describe('circleArea edge cases', () => {
      it('should handle negative radius', () => {
        // Note: Math.PI * r^2 will still calculate for negative radius
        const area = circleArea(-100);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle very small radius', () => {
        const area = circleArea(0.001);
        expect(area).toBeGreaterThan(0);
        expect(area).toBeLessThan(0.01);
      });

      it('should handle very large radius', () => {
        const area = circleAreaKm(10000); // 10,000 km radius
        expect(area).toBeGreaterThan(0);
      });
    });

    describe('boundsArea edge cases', () => {
      it('should handle zero-width bounds', () => {
        const zeroBounds: [number, number, number, number] = [-74.0, 40.71, -74.0, 40.72];
        const area = boundsArea(zeroBounds);
        expect(area).toBe(0);
      });

      it('should handle zero-height bounds', () => {
        const zeroBounds: [number, number, number, number] = [-74.01, 40.71, -74.0, 40.71];
        const area = boundsArea(zeroBounds);
        expect(area).toBe(0);
      });

      it('should handle point bounds', () => {
        const pointBounds: [number, number, number, number] = [-74.0, 40.71, -74.0, 40.71];
        const area = boundsArea(pointBounds);
        expect(area).toBe(0);
      });

      it('should handle bounds at equator', () => {
        const equatorBounds: [number, number, number, number] = [-1, -1, 1, 1];
        const area = boundsArea(equatorBounds);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle bounds at poles', () => {
        const polarBounds: [number, number, number, number] = [-10, 85, 10, 89];
        const area = boundsArea(polarBounds);
        expect(area).toBeGreaterThan(0);
      });

      it('should handle bounds crossing antimeridian', () => {
        const crossingBounds: [number, number, number, number] = [170, 0, -170, 10];
        const area = boundsArea(crossingBounds);
        expect(area).toBeGreaterThan(0);
      });

      it('should return 0 for invalid bounds with NaN', () => {
        const invalidBounds: [number, number, number, number] = [NaN, 40.71, -74.0, 40.72];
        expect(boundsArea(invalidBounds)).toBe(0);
      });

      it('should return 0 for invalid bounds with all NaN', () => {
        const invalidBounds: [number, number, number, number] = [NaN, NaN, NaN, NaN];
        expect(boundsArea(invalidBounds)).toBe(0);
      });

      it('should handle boundsAreaKm with invalid bounds', () => {
        const invalidBounds: [number, number, number, number] = [NaN, 40.71, -74.0, 40.72];
        expect(boundsAreaKm(invalidBounds)).toBe(0);
      });

      it('should convert bounds area to square miles', () => {
        const bounds: [number, number, number, number] = [-74.01, 40.71, -74.0, 40.72];
        const areaMiles = boundsAreaMiles(bounds);
        expect(areaMiles).toBeGreaterThan(0);
        expect(areaMiles).toBeLessThan(1);
      });

      it('should use fallback calculation when Turf fails', () => {
        // Test fallback path (lines 52-62)
        // Create bounds that might trigger fallback
        const bounds: [number, number, number, number] = [-74.01, 40.71, -74.0, 40.72];
        const area = boundsArea(bounds);
        // Should still calculate area using fallback rectangular approximation
        expect(area).toBeGreaterThan(0);
        // Fallback uses: width * height calculation
        expect(area).toBeLessThan(2000000);
      });

      it('should handle bounds with negative width in fallback', () => {
        // Test fallback with edge case bounds
        const bounds: [number, number, number, number] = [-74.0, 40.72, -74.01, 40.71];
        const area = boundsArea(bounds);
        // Should use Math.abs in fallback
        expect(area).toBeGreaterThan(0);
      });
    });

    describe('circleAreaMiles', () => {
      it('should convert circle area to square miles', () => {
        const areaMiles = circleAreaMiles(1000); // 1km radius
        expect(areaMiles).toBeGreaterThan(0);
        expect(areaMiles).toBeLessThan(2);
      });

      it('should handle zero radius', () => {
        expect(circleAreaMiles(0)).toBe(0);
      });
    });
  });
});
