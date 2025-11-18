import { describe, it, expect } from 'vitest';
import {
  lineLength,
  lineLengthMeters,
  lineLengthKm,
  lineLengthMiles,
  perimeterMeters,
  perimeterKm,
  perimeterMiles,
} from '../src/length';
import { haversine } from '../src/distance';
import type { Polygon } from '../src/types';

describe('length', () => {
  describe('lineLength', () => {
    const nyc: [number, number] = [40.7128, -74.006];
    const philly: [number, number] = [39.9526, -75.1652];
    const dc: [number, number] = [38.9072, -77.0369];

    it('should calculate length with custom distance function', () => {
      const calculateLength = lineLength(haversine(6371000));
      const polyline = [nyc, philly, dc];
      const length = calculateLength(polyline);

      expect(length).toBeGreaterThan(0);
      expect(length).toBeGreaterThan(300000); // More than 300km
    });

    it('should return 0 for empty array', () => {
      const calculateLength = lineLength(haversine(6371000));
      expect(calculateLength([])).toBe(0);
    });

    it('should return 0 for single point', () => {
      const calculateLength = lineLength(haversine(6371000));
      expect(calculateLength([nyc])).toBe(0);
    });

    it('should calculate length for two points', () => {
      const calculateLength = lineLength(haversine(6371000));
      const length = calculateLength([nyc, philly]);
      expect(length).toBeGreaterThan(100000); // ~130km
      expect(length).toBeLessThan(200000);
    });
  });

  describe('lineLengthMeters', () => {
    it('should calculate length in meters', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
        [40.7354, -73.99575],
      ];

      const length = lineLengthMeters(polyline);
      expect(length).toBeGreaterThan(0);
      expect(length).toBeGreaterThan(5000);
      expect(length).toBeLessThan(10000);
    });

    it('should return 0 for empty polyline', () => {
      expect(lineLengthMeters([])).toBe(0);
    });

    it('should handle very short distances', () => {
      const polyline: [number, number][] = [
        [0, 0],
        [0.0001, 0.0001],
      ];

      const length = lineLengthMeters(polyline);
      expect(length).toBeGreaterThan(0);
      expect(length).toBeLessThan(20);
    });

    it('should handle long distances', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006], // NYC
        [34.0522, -118.2437], // LA
      ];

      const length = lineLengthMeters(polyline);
      expect(length).toBeGreaterThan(3900000);
      expect(length).toBeLessThan(4000000);
    });
  });

  describe('lineLengthKm', () => {
    it('should calculate length in kilometers', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const length = lineLengthKm(polyline);
      expect(length).toBeGreaterThan(5);
      expect(length).toBeLessThan(7);
    });

    it('should match meters / 1000', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const lengthKm = lineLengthKm(polyline);
      const lengthMeters = lineLengthMeters(polyline);
      expect(lengthKm).toBeCloseTo(lengthMeters / 1000, 5);
    });
  });

  describe('lineLengthMiles', () => {
    it('should calculate length in miles', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const length = lineLengthMiles(polyline);
      expect(length).toBeGreaterThan(3);
      expect(length).toBeLessThan(5);
    });

    it('should match meters / 1609.34', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const lengthMiles = lineLengthMiles(polyline);
      const lengthMeters = lineLengthMeters(polyline);
      expect(lengthMiles).toBeCloseTo(lengthMeters / 1609.34, 3);
    });
  });

  describe('perimeter', () => {
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

    it('should calculate perimeter in meters', () => {
      const perimeter = perimeterMeters(square);
      expect(perimeter).toBeGreaterThan(0);
      expect(perimeter).toBeGreaterThan(3000);
      expect(perimeter).toBeLessThan(5000);
    });

    it('should calculate perimeter in kilometers', () => {
      const perimeter = perimeterKm(square);
      expect(perimeter).toBeGreaterThan(3);
      expect(perimeter).toBeLessThan(5);
    });

    it('should calculate perimeter in miles', () => {
      const perimeter = perimeterMiles(square);
      expect(perimeter).toBeGreaterThan(2);
      expect(perimeter).toBeLessThan(4);
    });

    it('should return 0 for empty polygon', () => {
      const empty: Polygon = {
        type: 'Polygon',
        coordinates: [],
      };
      expect(perimeterMeters(empty)).toBe(0);
    });

    it('should handle triangle', () => {
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

      const perimeter = perimeterMeters(triangle);
      expect(perimeter).toBeGreaterThan(0);
    });
  });
});
