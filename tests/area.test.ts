import { describe, it, expect } from 'vitest';
import {
  polygonArea,
  polygonAreaKm,
  polygonAreaMiles,
  circleArea,
  circleAreaKm,
  boundsArea,
  boundsAreaKm,
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
});
