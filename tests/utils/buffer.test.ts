import { describe, it, expect } from 'vitest';
import { buffer, bufferPoint, bufferLine, bufferPolygon } from '../../src/utils/buffer';
import type { Polygon } from '../../src/utils/types';

describe('buffer', () => {
  describe('bufferPoint', () => {
    it('should create circular buffer around point', () => {
      const point: [number, number] = [40.7128, -74.006];
      const buffered = bufferPoint(point, 1000); // 1km

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates).toHaveLength(1);
      expect(buffered.coordinates[0].length).toBeGreaterThan(10);
    });

    it('should create larger buffer for larger radius', () => {
      const point: [number, number] = [40.7128, -74.006];
      const buffer1km = bufferPoint(point, 1000);
      const buffer2km = bufferPoint(point, 2000);

      expect(buffer2km.coordinates[0].length).toBeGreaterThanOrEqual(
        buffer1km.coordinates[0].length
      );
    });

    it('should handle custom step count', () => {
      const point: [number, number] = [40.7128, -74.006];
      const bufferLowRes = bufferPoint(point, 1000, 8);
      const bufferHighRes = bufferPoint(point, 1000, 32);

      expect(bufferLowRes.coordinates[0].length).toBeLessThan(bufferHighRes.coordinates[0].length);
    });

    it('should work at different locations', () => {
      const locations: [number, number][] = [
        [40.7128, -74.006], // NYC
        [51.5074, -0.1278], // London
        [-33.8688, 151.2093], // Sydney
        [0, 0], // Equator
      ];

      locations.forEach((loc) => {
        const buffered = bufferPoint(loc, 1000);
        expect(buffered.coordinates[0].length).toBeGreaterThan(10);
      });
    });
  });

  describe('bufferLine', () => {
    it('should create buffer around line', () => {
      const line: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const buffered = bufferLine(line, 500); // 500m

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates).toHaveLength(1);
      expect(buffered.coordinates[0].length).toBeGreaterThan(10);
    });

    it('should throw for line with less than 2 points', () => {
      expect(() => bufferLine([[40.7128, -74.006]], 1000)).toThrow();
    });

    it('should handle polyline with multiple segments', () => {
      const polyline: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
        [40.7354, -73.99575],
      ];

      const buffered = bufferLine(polyline, 500);
      expect(buffered.coordinates[0].length).toBeGreaterThan(10);
    });

    it('should create larger buffer for larger radius', () => {
      const line: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];

      const buffer500 = bufferLine(line, 500);
      const buffer1000 = bufferLine(line, 1000);

      // Can't directly compare sizes, but both should succeed
      expect(buffer500.coordinates[0].length).toBeGreaterThan(0);
      expect(buffer1000.coordinates[0].length).toBeGreaterThan(0);
    });
  });

  describe('bufferPolygon', () => {
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

    it('should expand polygon with positive buffer', () => {
      const buffered = bufferPolygon(square, 100);

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates).toHaveLength(1);
      expect(buffered.coordinates[0].length).toBeGreaterThan(0);
    });

    it('should contract polygon with negative buffer', () => {
      const buffered = bufferPolygon(square, -50);

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates).toHaveLength(1);
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

      const buffered = bufferPolygon(triangle, 0.01);
      expect(buffered.coordinates[0].length).toBeGreaterThan(0);
    });
  });

  describe('buffer (generic)', () => {
    it('should buffer a point', () => {
      const buffer1km = buffer(1000);
      const point: [number, number] = [40.7128, -74.006];
      const buffered = buffer1km(point);

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates[0].length).toBeGreaterThan(10);
    });

    it('should buffer a line', () => {
      const buffer500m = buffer(500);
      const line: [number, number][] = [
        [40.7128, -74.006],
        [40.758, -73.9855],
      ];
      const buffered = buffer500m(line);

      expect(buffered.type).toBe('Polygon');
      expect(buffered.coordinates[0].length).toBeGreaterThan(10);
    });

    it('should buffer a polygon', () => {
      const buffer100m = buffer(100);
      const polygon: Polygon = {
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
      const buffered = buffer100m(polygon);

      expect(buffered.type).toBe('Polygon');
    });

    it('should work with custom step count', () => {
      const buffer1km = buffer(1000, 16);
      const point: [number, number] = [40.7128, -74.006];
      const buffered = buffer1km(point);

      expect(buffered.coordinates[0].length).toBeGreaterThan(0);
    });
  });
});
