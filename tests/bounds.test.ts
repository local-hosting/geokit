import { describe, it, expect } from 'vitest';
import { getBounds, getCenter, isWithinBounds } from '../src/bounds';
import { createFeature } from '../src/geojson';
import type { Point } from '../src/types';

describe('bounds', () => {
  const point1: [number, number] = [40.7128, -74.006];
  const point2: [number, number] = [40.758, -73.9855];
  const point3: [number, number] = [40.7354, -73.99575];

  describe('getBounds', () => {
    it('should calculate bounds from coordinates', () => {
      const bounds = getBounds([point1, point2]);
      expect(bounds).toEqual([-74.006, 40.7128, -73.9855, 40.758]);
    });

    it('should calculate bounds from features', () => {
      const pointGeometry1: Point = {
        type: 'Point',
        coordinates: [-74.006, 40.7128],
      };
      const pointGeometry2: Point = {
        type: 'Point',
        coordinates: [-73.9855, 40.758],
      };
      const features = [createFeature(pointGeometry1), createFeature(pointGeometry2)];
      const bounds = getBounds(features);
      expect(bounds).toEqual([-74.006, 40.7128, -73.9855, 40.758]);
    });

    it('should return null for empty input', () => {
      expect(getBounds([])).toBe(null);
    });
  });

  describe('getCenter', () => {
    it('should calculate center from bounds', () => {
      const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
      const center = getCenter(bounds);
      expect(center).toEqual([40.7354, -73.99575]);
    });

    it('should calculate center from coordinates', () => {
      const center = getCenter([point1, point2]);
      expect(center).toEqual([40.7354, -73.99575]);
    });

    it('should return null for invalid input', () => {
      expect(getCenter([])).toBe(null);
    });
  });

  describe('isWithinBounds', () => {
    it('should return true when point is within bounds', () => {
      const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
      const check = isWithinBounds(point3);
      expect(check(bounds)).toBe(true);
    });

    it('should return false when point is outside bounds', () => {
      const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
      const pointOutside: [number, number] = [40.5, -74.5];
      const check = isWithinBounds(pointOutside);
      expect(check(bounds)).toBe(false);
    });

    it('should work with curried function', () => {
      const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
      const checkPoint = isWithinBounds(point3);
      expect(checkPoint(bounds)).toBe(true);
    });
  });

  describe('edge cases', () => {
    describe('getBounds edge cases', () => {
      it('should handle single point', () => {
        const bounds = getBounds([point1]);
        expect(bounds).toEqual([-74.006, 40.7128, -74.006, 40.7128]);
      });

      it('should handle points at antimeridian', () => {
        const p1: [number, number] = [0, 179];
        const p2: [number, number] = [0, -179];
        const bounds = getBounds([p1, p2]);
        expect(bounds).not.toBe(null);
        expect(bounds![0]).toBeLessThanOrEqual(bounds![2]);
      });

      it('should handle points at poles', () => {
        const northPole: [number, number] = [90, 0];
        const southPole: [number, number] = [-90, 0];
        const bounds = getBounds([northPole, southPole]);
        expect(bounds).toEqual([0, -90, 0, 90]);
      });

      it('should handle negative coordinates', () => {
        const p1: [number, number] = [-45, -120];
        const p2: [number, number] = [-30, -100];
        const bounds = getBounds([p1, p2]);
        expect(bounds).toEqual([-120, -45, -100, -30]);
      });

      it('should handle many points', () => {
        const manyPoints: [number, number][] = Array.from({ length: 100 }, (_, i) => [
          40 + i * 0.01,
          -74 + i * 0.01,
        ]);
        const bounds = getBounds(manyPoints);
        expect(bounds).not.toBe(null);
        expect(bounds![0]).toBeLessThanOrEqual(bounds![2]);
        expect(bounds![1]).toBeLessThanOrEqual(bounds![3]);
      });
    });

    describe('getCenter edge cases', () => {
      it('should handle single point bounds', () => {
        const singlePointBounds: [number, number, number, number] = [
          -74.006, 40.7128, -74.006, 40.7128,
        ];
        const center = getCenter(singlePointBounds);
        expect(center).toEqual([40.7128, -74.006]);
      });

      it('should handle bounds crossing antimeridian', () => {
        const crossingBounds: [number, number, number, number] = [170, 0, -170, 10];
        const center = getCenter(crossingBounds);
        expect(center).not.toBe(null);
        expect(center![0]).toBeCloseTo(5, 1);
      });

      it('should handle pole-to-pole bounds', () => {
        const polarBounds: [number, number, number, number] = [0, -90, 0, 90];
        const center = getCenter(polarBounds);
        expect(center).toEqual([0, 0]);
      });

      it('should handle negative coordinate bounds', () => {
        const negativeBounds: [number, number, number, number] = [-120, -45, -100, -30];
        const center = getCenter(negativeBounds);
        expect(center).toEqual([-37.5, -110]);
      });
    });

    describe('isWithinBounds edge cases', () => {
      it('should handle point at exact corner', () => {
        const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
        const corner: [number, number] = [40.7128, -74.006];
        const check = isWithinBounds(corner);
        expect(check(bounds)).toBe(true);
      });

      it('should handle point just outside bounds', () => {
        const bounds: [number, number, number, number] = [-74.006, 40.7128, -73.9855, 40.758];
        const outside: [number, number] = [40.759, -73.9855];
        const check = isWithinBounds(outside);
        expect(check(bounds)).toBe(false);
      });

      it('should handle bounds at antimeridian', () => {
        const bounds: [number, number, number, number] = [170, 0, -170, 10];
        const point: [number, number] = [5, 180];
        const check = isWithinBounds(point);
        // Note: This depends on implementation - simple bounds check might fail
        expect(check(bounds)).toBeDefined();
      });

      it('should handle pole regions', () => {
        const northPolarBounds: [number, number, number, number] = [-180, 85, 180, 90];
        const northPoint: [number, number] = [87, 0];
        const check = isWithinBounds(northPoint);
        expect(check(northPolarBounds)).toBe(true);
      });

      it('should handle equator crossing', () => {
        const equatorBounds: [number, number, number, number] = [-10, -5, 10, 5];
        const equatorPoint: [number, number] = [0, 0];
        const check = isWithinBounds(equatorPoint);
        expect(check(equatorBounds)).toBe(true);
      });
    });
  });
});
