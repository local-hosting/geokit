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
});
