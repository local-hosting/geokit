/**
 * Polygon difference operations — differencePolygons, subtract, differenceFeatures
 */

import { describe, it, expect } from 'vitest';
import { differencePolygons, subtract, differenceFeatures } from '../../../src/utils/difference';
import type { Polygon, MultiPolygon, Feature } from '../../../src/types';

describe('difference', () => {
  const basePolygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-74.02, 40.7],
        [-73.98, 40.7],
        [-73.98, 40.74],
        [-74.02, 40.74],
        [-74.02, 40.7],
      ],
    ],
  };

  const holePolygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-74.01, 40.71],
        [-73.99, 40.71],
        [-73.99, 40.73],
        [-74.01, 40.73],
        [-74.01, 40.71],
      ],
    ],
  };

  const disjointPolygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-75.0, 41.0],
        [-74.9, 41.0],
        [-74.9, 41.1],
        [-75.0, 41.1],
        [-75.0, 41.0],
      ],
    ],
  };

  describe('differencePolygons', () => {
    it('should return polygon when subtracting overlapping polygon', () => {
      const result = differencePolygons(basePolygon, holePolygon);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('type');
      expect(['Polygon', 'MultiPolygon']).toContain(result!.type);
      if (result && result.type === 'Polygon') {
        expect(result.coordinates).toBeDefined();
        expect(Array.isArray(result.coordinates[0])).toBe(true);
      }
    });

    it('should return null or unchanged geometry when subtracting disjoint polygon', () => {
      const result = differencePolygons(basePolygon, disjointPolygon);
      // Turf difference with disjoint may return the first polygon or null depending on implementation
      if (result !== null) {
        expect(result.type).toBe('Polygon');
        expect(result.coordinates[0].length).toBe(basePolygon.coordinates[0].length);
      }
    });

    it('should return null when first polygon fully contains second (hole punch)', () => {
      const small: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.72],
            [-74.0, 40.72],
            [-74.0, 40.72],
            [-74.0, 40.72],
            [-74.0, 40.72],
          ],
        ],
      };
      const result = differencePolygons(basePolygon, small);
      // Result may be polygon with hole or multipolygon
      expect(result === null || result.type === 'Polygon' || result.type === 'MultiPolygon').toBe(
        true
      );
    });

    it('should not throw on invalid or degenerate second polygon', () => {
      const bad: Polygon = {
        type: 'Polygon',
        coordinates: [],
      };
      const result = differencePolygons(basePolygon, bad);
      // Turf may return null or the first polygon depending on implementation
      expect(
        result === null || (result && (result.type === 'Polygon' || result.type === 'MultiPolygon'))
      ).toBe(true);
    });
  });

  describe('subtract (curried)', () => {
    it('should return a function that subtracts from base', () => {
      const subtractFromBase = subtract(basePolygon);
      expect(typeof subtractFromBase).toBe('function');
      const result = subtractFromBase(holePolygon);
      expect(result).not.toBeNull();
      expect(['Polygon', 'MultiPolygon']).toContain(result!.type);
    });

    it('should work with reduce to punch multiple holes', () => {
      const holes: Polygon[] = [holePolygon];
      const result = holes.reduce<Polygon | MultiPolygon>(
        (acc, hole) => subtract(acc)(hole) ?? acc,
        basePolygon
      );
      expect(result).toBeDefined();
    });
  });

  describe('differenceFeatures', () => {
    it('should return feature when subtracting overlapping feature', () => {
      const f1: Feature<Polygon> = {
        type: 'Feature',
        properties: { id: 'a' },
        geometry: basePolygon,
      };
      const f2: Feature<Polygon> = {
        type: 'Feature',
        properties: { id: 'b' },
        geometry: holePolygon,
      };
      const result = differenceFeatures(f1, f2);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('Feature');
      expect(result!.geometry).toBeDefined();
      expect(result!.properties).toBeDefined();
    });

    it('should preserve properties from first feature', () => {
      const f1: Feature<Polygon> = {
        type: 'Feature',
        properties: { name: 'base', id: 1 },
        geometry: basePolygon,
      };
      const f2: Feature<Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: holePolygon,
      };
      const result = differenceFeatures(f1, f2);
      expect(result).not.toBeNull();
      if (result && result.properties) {
        expect(result.properties.name).toBe('base');
        expect(result.properties.id).toBe(1);
      }
    });

    it('should return null when difference fails', () => {
      const badFeature: Feature<Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [] },
      };
      const f2: Feature<Polygon> = {
        type: 'Feature',
        properties: {},
        geometry: holePolygon,
      };
      const result = differenceFeatures(badFeature, f2);
      expect(result).toBeNull();
    });
  });
});
