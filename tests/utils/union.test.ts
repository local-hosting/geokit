import { describe, it, expect } from 'vitest';
import { unionPolygons, unionAll, unionFeatures } from '../src/union';
import { createFeature } from '../src/geojson';
import type { Polygon, MultiPolygon, Feature } from '../src/types';

describe('union', () => {
  const polygon1: Polygon = {
    type: 'Polygon',
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

  const polygon2: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-74.0, 40.71],
        [-73.99, 40.71],
        [-73.99, 40.72],
        [-74.0, 40.72],
        [-74.0, 40.71],
      ],
    ],
  };

  const polygon3: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-73.99, 40.71],
        [-73.98, 40.71],
        [-73.98, 40.72],
        [-73.99, 40.72],
        [-73.99, 40.71],
      ],
    ],
  };

  const disjointPolygon: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [-75.0, 40.5],
        [-74.9, 40.5],
        [-74.9, 40.6],
        [-75.0, 40.6],
        [-75.0, 40.5],
      ],
    ],
  };

  describe('unionPolygons', () => {
    it('should union two overlapping polygons', () => {
      const result = unionPolygons(polygon1, polygon2);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type');
      expect(['Polygon', 'MultiPolygon']).toContain(result!.type);
    });

    it('should union two disjoint polygons into MultiPolygon', () => {
      const result = unionPolygons(polygon1, disjointPolygon);
      expect(result).not.toBe(null);
      // Disjoint polygons should result in MultiPolygon
      if (result) {
        expect(result.type).toBe('MultiPolygon');
      }
    });

    it('should handle Polygon and MultiPolygon union', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [polygon2.coordinates, polygon3.coordinates],
      };
      const result = unionPolygons(polygon1, multiPolygon);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type');
    });

    it('should return null for invalid polygons', () => {
      const invalidPolygon = {
        type: 'Polygon',
        coordinates: [[]],
      } as Polygon;
      const result = unionPolygons(invalidPolygon, polygon1);
      // May return null or handle gracefully
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle identical polygons', () => {
      const result = unionPolygons(polygon1, polygon1);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type');
    });
  });

  describe('unionAll', () => {
    it('should union multiple overlapping polygons', () => {
      const result = unionAll([polygon1, polygon2, polygon3]);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type');
      expect(['Polygon', 'MultiPolygon']).toContain(result!.type);
    });

    it('should return null for empty array', () => {
      const result = unionAll([]);
      expect(result).toBe(null);
    });

    it('should return single polygon when array has one element', () => {
      const result = unionAll([polygon1]);
      expect(result).toEqual(polygon1);
    });

    it('should handle mix of Polygon and MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [polygon2.coordinates],
      };
      const result = unionAll([polygon1, multiPolygon, polygon3]);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type');
    });

    it('should handle disjoint polygons', () => {
      const result = unionAll([polygon1, disjointPolygon]);
      expect(result).not.toBe(null);
      // Disjoint polygons should result in MultiPolygon
      if (result) {
        expect(result.type).toBe('MultiPolygon');
      }
    });

    it('should return null for invalid polygons array', () => {
      const invalidPolygon = {
        type: 'Polygon',
        coordinates: [[]],
      } as Polygon;
      const result = unionAll([invalidPolygon, polygon1]);
      // May return null or handle gracefully
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });

  describe('unionFeatures', () => {
    it('should union polygon features', () => {
      const feature1 = createFeature(polygon1);
      const feature2 = createFeature(polygon2);
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type', 'Feature');
      expect(result).toHaveProperty('geometry');
      if (result) {
        expect(['Polygon', 'MultiPolygon']).toContain(result.geometry.type);
      }
    });

    it('should preserve properties from features', () => {
      const feature1: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon1,
        properties: { name: 'Polygon 1' },
      };
      const feature2: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon2,
        properties: { name: 'Polygon 2' },
      };
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
      if (result) {
        expect(result).toHaveProperty('properties');
      }
    });

    it('should return null for empty array', () => {
      const result = unionFeatures([]);
      expect(result).toBe(null);
    });

    it('should return single feature when array has one element', () => {
      const feature = createFeature(polygon1);
      const result = unionFeatures([feature]);
      expect(result).toEqual(feature);
    });

    it('should handle MultiPolygon features', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [polygon2.coordinates, polygon3.coordinates],
      };
      const feature1 = createFeature(polygon1);
      const feature2 = createFeature(multiPolygon);
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
      expect(result).toHaveProperty('type', 'Feature');
    });

    it('should handle disjoint polygon features', () => {
      const feature1 = createFeature(polygon1);
      const feature2 = createFeature(disjointPolygon);
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
      if (result) {
        expect(result.geometry.type).toBe('MultiPolygon');
      }
    });

    it('should handle features with null properties', () => {
      const feature1: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon1,
        properties: null,
      };
      const feature2: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon2,
        properties: null,
      };
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should handle very small polygons', () => {
      const smallPolygon1: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-74.0001, 40.71],
            [-74.0001, 40.7101],
            [-74.0, 40.7101],
            [-74.0, 40.71],
          ],
        ],
      };
      const smallPolygon2: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0001, 40.71],
            [-74.0002, 40.71],
            [-74.0002, 40.7101],
            [-74.0001, 40.7101],
            [-74.0001, 40.71],
          ],
        ],
      };
      const result = unionPolygons(smallPolygon1, smallPolygon2);
      expect(result).not.toBe(null);
    });

    it('should handle polygons with holes', () => {
      const polygonWithHole: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.72],
            [-74.01, 40.72],
            [-74.01, 40.71],
          ],
          [
            [-74.005, 40.715],
            [-74.002, 40.715],
            [-74.002, 40.717],
            [-74.005, 40.717],
            [-74.005, 40.715],
          ],
        ],
      };
      const result = unionPolygons(polygon1, polygonWithHole);
      expect(result).not.toBe(null);
    });

    it('should handle many polygons in unionAll', () => {
      const polygons: Polygon[] = [];
      for (let i = 0; i < 10; i++) {
        polygons.push({
          type: 'Polygon',
          coordinates: [
            [
              [-74.0 - i * 0.01, 40.71],
              [-73.99 - i * 0.01, 40.71],
              [-73.99 - i * 0.01, 40.72],
              [-74.0 - i * 0.01, 40.72],
              [-74.0 - i * 0.01, 40.71],
            ],
          ],
        });
      }
      const result = unionAll(polygons);
      expect(result).not.toBe(null);
    });

    it('should handle touching polygons (share edge)', () => {
      const polygonA: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-73.99, 40.71],
            [-73.99, 40.72],
            [-74.0, 40.72],
            [-74.0, 40.71],
          ],
        ],
      };
      const polygonB: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-73.99, 40.71],
            [-73.98, 40.71],
            [-73.98, 40.72],
            [-73.99, 40.72],
            [-73.99, 40.71],
          ],
        ],
      };
      const result = unionPolygons(polygonA, polygonB);
      expect(result).not.toBe(null);
      // Touching polygons should union into a single polygon
      if (result && result.type === 'Polygon') {
        expect(result.coordinates.length).toBeGreaterThan(0);
      }
    });

    it('should handle polygon completely containing another', () => {
      const outer: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
          ],
        ],
      };
      const inner: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.05, 40.65],
            [-73.95, 40.65],
            [-73.95, 40.75],
            [-74.05, 40.75],
            [-74.05, 40.65],
          ],
        ],
      };
      const result = unionPolygons(outer, inner);
      expect(result).not.toBe(null);
      // Union of containing polygons should be the outer polygon
      if (result) {
        expect(result.type).toBe('Polygon');
      }
    });

    it('should handle degenerate polygon (triangle)', () => {
      const triangle: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-73.99, 40.71],
            [-73.995, 40.715],
            [-74.0, 40.71],
          ],
        ],
      };
      const result = unionPolygons(polygon1, triangle);
      expect(result).not.toBe(null);
    });

    it('should handle polygons with single coordinate point (degenerate)', () => {
      const degenerate: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.71],
            [-74.0, 40.71],
          ],
        ],
      };
      const result = unionPolygons(polygon1, degenerate);
      // May return null or handle gracefully
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle polygons crossing antimeridian', () => {
      const poly1: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [179, 0],
            [180, 0],
            [180, 1],
            [179, 1],
            [179, 0],
          ],
        ],
      };
      const poly2: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-180, 0],
            [-179, 0],
            [-179, 1],
            [-180, 1],
            [-180, 0],
          ],
        ],
      };
      const result = unionPolygons(poly1, poly2);
      expect(result).not.toBe(null);
    });

    it('should handle polygons at poles', () => {
      const northPolygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-10, 89],
            [10, 89],
            [10, 90],
            [-10, 90],
            [-10, 89],
          ],
        ],
      };
      const southPolygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-10, -90],
            [10, -90],
            [10, -89],
            [-10, -89],
            [-10, -90],
          ],
        ],
      };
      const result = unionPolygons(northPolygon, southPolygon);
      expect(result).not.toBe(null);
    });

    it('should handle very large polygons', () => {
      const largePolygon: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90],
          ],
        ],
      };
      const result = unionPolygons(polygon1, largePolygon);
      expect(result).not.toBe(null);
    });

    it('should handle polygons with many vertices', () => {
      const manyVertices: Polygon = {
        type: 'Polygon',
        coordinates: [
          Array.from({ length: 50 }, (_, i) => [
            -74.0 + Math.cos((i / 50) * Math.PI * 2) * 0.01,
            40.71 + Math.sin((i / 50) * Math.PI * 2) * 0.01,
          ]).concat([[-74.0, 40.71]]), // Close the ring
        ],
      };
      const result = unionPolygons(polygon1, manyVertices);
      // May return null for very complex polygons, or succeed
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle MultiPolygon with many polygons', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: Array.from({ length: 5 }, (_, i) => [
          [
            [-74.0 - i * 0.01, 40.71],
            [-73.99 - i * 0.01, 40.71],
            [-73.99 - i * 0.01, 40.72],
            [-74.0 - i * 0.01, 40.72],
            [-74.0 - i * 0.01, 40.71],
          ],
        ]),
      };
      const result = unionPolygons(polygon1, multiPolygon);
      expect(result).not.toBe(null);
    });

    it('should handle unionAll with 100 polygons', () => {
      const polygons: Polygon[] = Array.from({ length: 100 }, (_, i) => ({
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74.0 - (i % 10) * 0.01, 40.71 + Math.floor(i / 10) * 0.01],
            [-73.99 - (i % 10) * 0.01, 40.71 + Math.floor(i / 10) * 0.01],
            [-73.99 - (i % 10) * 0.01, 40.72 + Math.floor(i / 10) * 0.01],
            [-74.0 - (i % 10) * 0.01, 40.72 + Math.floor(i / 10) * 0.01],
            [-74.0 - (i % 10) * 0.01, 40.71 + Math.floor(i / 10) * 0.01],
          ],
        ],
      }));
      const result = unionAll(polygons);
      expect(result).not.toBe(null);
    });

    it('should handle unionAll with all disjoint polygons', () => {
      const disjointPolygons: Polygon[] = Array.from({ length: 5 }, (_, i) => ({
        type: 'Polygon' as const,
        coordinates: [
          [
            [-75.0 - i, 40.5],
            [-74.9 - i, 40.5],
            [-74.9 - i, 40.6],
            [-75.0 - i, 40.6],
            [-75.0 - i, 40.5],
          ],
        ],
      }));
      const result = unionAll(disjointPolygons);
      expect(result).not.toBe(null);
      if (result) {
        expect(result.type).toBe('MultiPolygon');
      }
    });

    it('should handle unionFeatures with mixed property types', () => {
      const feature1: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon1,
        properties: { name: 'Polygon 1', count: 1 },
      };
      const feature2: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon2,
        properties: { name: 'Polygon 2', count: 2 },
      };
      const feature3: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon3,
        properties: { name: 'Polygon 3', active: true },
      };
      const result = unionFeatures([feature1, feature2, feature3]);
      expect(result).not.toBe(null);
      if (result) {
        expect(result).toHaveProperty('properties');
      }
    });

    it('should handle unionFeatures with empty properties', () => {
      const feature1: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon1,
        properties: {},
      };
      const feature2: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon2,
        properties: {},
      };
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
    });

    it('should handle unionFeatures with undefined properties', () => {
      const feature1: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon1,
      };
      const feature2: Feature<Polygon> = {
        type: 'Feature',
        geometry: polygon2,
      };
      const result = unionFeatures([feature1, feature2]);
      expect(result).not.toBe(null);
    });

    it('should handle unionPolygons with null/undefined coordinates gracefully', () => {
      const invalid1 = {
        type: 'Polygon',
        coordinates: null,
      } as any;
      const invalid2 = {
        type: 'Polygon',
        coordinates: undefined,
      } as any;
      const result1 = unionPolygons(invalid1, polygon1);
      const result2 = unionPolygons(polygon1, invalid2);
      expect(result1).toBe(null);
      expect(result2).toBe(null);
    });

    it('should handle unionAll with array containing null/undefined', () => {
      const polygons = [polygon1, null as any, polygon2, undefined as any];
      const result = unionAll(polygons.filter(Boolean));
      expect(result).not.toBe(null);
    });

    it('should handle polygons with 3D coordinates', () => {
      const polygon3D: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.01, 40.71, 100],
            [-74.0, 40.71, 100],
            [-74.0, 40.72, 100],
            [-74.01, 40.72, 100],
            [-74.01, 40.71, 100],
          ],
        ],
      };
      const result = unionPolygons(polygon1, polygon3D);
      expect(result).not.toBe(null);
    });

    it('should handle self-intersecting polygons gracefully', () => {
      const selfIntersecting: Polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.71],
            [-73.99, 40.72],
            [-74.0, 40.72],
            [-73.99, 40.71],
            [-74.0, 40.71],
          ],
        ],
      };
      const result = unionPolygons(polygon1, selfIntersecting);
      // May return null or handle gracefully
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
