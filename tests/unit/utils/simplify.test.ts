import { describe, it, expect } from 'vitest';
import { simplify, simplifyMeters } from '../../../src/utils/simplify';
import { simplifyGeometry, simplifyGeometryMeters } from '../../../src/utils/simplify/geometry';
import { simplifyPolygonRingToMaxPoints } from '../../../src/utils/simplify/polygon';

const samplePolygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-74.1, 40.6],
      [-73.9, 40.6],
      [-73.9, 40.601],
      [-73.901, 40.602],
      [-73.902, 40.603],
      [-73.9, 40.8],
      [-74.1, 40.8],
      [-74.1, 40.6],
    ],
  ],
};

describe('simplify', () => {
  describe('simplify', () => {
    const zigzag: [number, number][] = [
      [40.71, -74.01],
      [40.711, -74.009],
      [40.712, -74.008],
      [40.713, -74.007],
      [40.714, -74.006],
      [40.715, -74.005],
      [40.72, -74.0],
    ];

    it('should simplify polyline with given tolerance', () => {
      const simplified = simplify(0.01)(zigzag);
      expect(simplified.length).toBeLessThan(zigzag.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should keep start and end points', () => {
      const simplified = simplify(0.01)(zigzag);
      expect(simplified[0]).toEqual(zigzag[0]);
      expect(simplified[simplified.length - 1]).toEqual(zigzag[zigzag.length - 1]);
    });

    it('should return original for polylines with <= 2 points', () => {
      const short = [
        [40.71, -74.01],
        [40.72, -74.0],
      ] as [number, number][];
      const simplified = simplify(0.01)(short);
      expect(simplified).toEqual(short);
    });

    it('should retain most points when tolerance is very small', () => {
      const simplified = simplify(0.0001)(zigzag);
      // Very small tolerance should keep most points
      expect(simplified.length).toBeGreaterThanOrEqual(2);
      expect(simplified.length).toBeLessThanOrEqual(zigzag.length);
    });
  });

  describe('simplifyMeters', () => {
    const polyline: [number, number][] = [
      [40.71, -74.01],
      [40.711, -74.009],
      [40.712, -74.008],
      [40.713, -74.007],
      [40.72, -74.0],
    ];

    it('should simplify using meters tolerance', () => {
      const simplified = simplifyMeters(500)(polyline);
      expect(simplified.length).toBeLessThanOrEqual(polyline.length);
      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for empty polyline', () => {
      const simplified = simplifyMeters(100)([]);
      expect(simplified).toEqual([]);
    });

    it('should keep more points with smaller tolerance', () => {
      const simplified100 = simplifyMeters(100)(polyline);
      const simplified1000 = simplifyMeters(1000)(polyline);
      expect(simplified100.length).toBeGreaterThanOrEqual(simplified1000.length);
    });
  });

  describe('simplifyGeometry', () => {
    it('simplifies polygon geometries with tolerance in degrees', () => {
      const simplified = simplifyGeometry(0.01)(samplePolygon);
      expect(simplified.type).toBe('Polygon');
      expect(simplified.coordinates[0].length).toBeLessThanOrEqual(samplePolygon.coordinates[0].length);
    });

    it('returns original geometry for invalid input', () => {
      const invalid = { type: 'Polygon', coordinates: undefined } as unknown as typeof samplePolygon;
      expect(simplifyGeometry(0.01)(invalid)).toBe(invalid);
    });

    it('simplifies multipolygon geometries using meter tolerance', () => {
      const multi = {
        type: 'MultiPolygon' as const,
        coordinates: [samplePolygon.coordinates],
      };
      const simplified = simplifyGeometryMeters(500)(multi);
      expect(simplified.type).toBe('MultiPolygon');
      expect(simplified.coordinates[0][0].length).toBeLessThanOrEqual(
        samplePolygon.coordinates[0].length
      );
    });
  });

  describe('simplifyPolygonRingToMaxPoints', () => {
    it('simplifies closed rings for static map overlays', () => {
      const openRing: [number, number][] = [];
      for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2;
        openRing.push([40.7 + Math.sin(angle) * 0.2, -74.0 + Math.cos(angle) * 0.2]);
      }
      const closedRing: [number, number][] = [...openRing, openRing[0]];

      const simplified = simplifyPolygonRingToMaxPoints(40)(closedRing);
      expect(simplified.length - 1).toBeLessThanOrEqual(40);
      expect(simplified.length).toBeGreaterThan(4);
      expect(simplified[0]).toEqual(simplified[simplified.length - 1]);
    });
  });
});
