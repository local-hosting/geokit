import { describe, it, expect } from 'vitest';
import {
  coordinatesToH3,
  h3ToCoordinates,
  h3ToBoundary,
  h3ToPolygon,
  h3Neighbors,
  snapToH3Cell,
  h3ToParent,
  h3ToChildren,
  h3GetResolution,
  validateH3,
  h3AreNeighbors,
  h3EdgeLength,
  h3CellArea,
  h3SetToMultiPolygon,
  polygonToH3,
  // Type-safe functions
  coordinatesToH3Point,
  coordinatesToH3Area,
  h3PointToCoordinates,
  h3AreaToCoordinates,
  h3PointToBoundary,
  h3AreaToBoundary,
  h3PointToPolygon,
  h3AreaToPolygon,
  h3PointNeighbors,
  h3AreaNeighbors,
  h3ResolutionFromZoom,
  h3DiskToFeatureCollection,
} from '../../../src/utils/h3';

describe('h3', () => {
  const nyc: [number, number] = [40.7128, -74.006];

  describe('coordinatesToH3', () => {
    it('should convert coordinates to H3 index', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      expect(typeof h3Index).toBe('string');
      expect(h3Index.length).toBeGreaterThan(0);
    });

    it('should use default resolution of 9', () => {
      const h3Index = coordinatesToH3()(nyc);
      const resolution = h3GetResolution(h3Index);
      expect(resolution).toBe(9);
    });
  });

  describe('h3ToCoordinates', () => {
    it('should convert H3 index to coordinates', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const coords = h3ToCoordinates(h3Index);
      expect(coords[0]).toBeCloseTo(nyc[0], 2);
      expect(coords[1]).toBeCloseTo(nyc[1], 2);
    });

    it('should roundtrip coordinates', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const coords = h3ToCoordinates(h3Index);
      const h3Index2 = coordinatesToH3(9)(coords);
      expect(h3Index2).toBe(h3Index);
    });
  });

  describe('h3ToBoundary', () => {
    it('should return cell boundary as polygon', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const boundary = h3ToBoundary(h3Index);
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThan(0);
      expect(boundary[0]).toHaveLength(2);
    });
  });

  describe('h3ToPolygon', () => {
    it('should return GeoJSON Polygon', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const polygon = h3ToPolygon(h3Index);
      expect(polygon.type).toBe('Polygon');
      expect(Array.isArray(polygon.coordinates)).toBe(true);
      expect(polygon.coordinates.length).toBe(1);
      expect(polygon.coordinates[0].length).toBeGreaterThan(0);
      // GeoJSON uses [lon, lat] format
      expect(polygon.coordinates[0][0]).toHaveLength(2);
    });

    it('should have valid polygon structure', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const polygon = h3ToPolygon(h3Index);
      const ring = polygon.coordinates[0];
      // H3 boundaries should have at least 6 points (hexagon)
      expect(ring.length).toBeGreaterThanOrEqual(6);
      // All points should be valid coordinates
      ring.forEach((point) => {
        expect(point).toHaveLength(2);
        expect(typeof point[0]).toBe('number');
        expect(typeof point[1]).toBe('number');
      });
    });

    it('should match boundary coordinates in GeoJSON format', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const boundary = h3ToBoundary(h3Index);
      const polygon = h3ToPolygon(h3Index);
      const ring = polygon.coordinates[0];
      // Boundary is [lat, lon], polygon is [lon, lat]
      // Ring has +1 point because GeoJSON requires closed rings (first = last)
      expect(ring.length).toBe(boundary.length + 1);
      for (let i = 0; i < boundary.length; i++) {
        expect(ring[i][0]).toBeCloseTo(boundary[i][1], 5); // lon
        expect(ring[i][1]).toBeCloseTo(boundary[i][0], 5); // lat
      }
      // Verify ring is closed (first point equals last point)
      expect(ring[0][0]).toBeCloseTo(ring[ring.length - 1][0], 10);
      expect(ring[0][1]).toBeCloseTo(ring[ring.length - 1][1], 10);
    });
  });

  describe('snapToH3Cell', () => {
    it('should snap coordinates to cell center', () => {
      const coords: [number, number] = [40.7128, -74.006];
      const snapped = snapToH3Cell(9)(coords);
      expect(snapped).toHaveLength(2);
      expect(typeof snapped[0]).toBe('number');
      expect(typeof snapped[1]).toBe('number');
    });

    it('should use default resolution of 9', () => {
      const coords: [number, number] = [40.7128, -74.006];
      const snapped1 = snapToH3Cell(9)(coords);
      const snapped2 = snapToH3Cell()(coords);
      expect(snapped1[0]).toBeCloseTo(snapped2[0], 5);
      expect(snapped1[1]).toBeCloseTo(snapped2[1], 5);
    });

    it('should return same result as h3ToCoordinates after coordinatesToH3', () => {
      const coords: [number, number] = [40.7128, -74.006];
      const snapped = snapToH3Cell(9)(coords);
      const h3Index = coordinatesToH3(9)(coords);
      const cellCenter = h3ToCoordinates(h3Index);
      expect(snapped[0]).toBeCloseTo(cellCenter[0], 5);
      expect(snapped[1]).toBeCloseTo(cellCenter[1], 5);
    });

    it('should snap to different centers at different resolutions', () => {
      const coords: [number, number] = [40.7128, -74.006];
      const snapped9 = snapToH3Cell(9)(coords);
      const snapped10 = snapToH3Cell(10)(coords);
      // Higher resolution should be closer to original (or same if already aligned)
      const dist9 = Math.abs(snapped9[0] - coords[0]) + Math.abs(snapped9[1] - coords[1]);
      const dist10 = Math.abs(snapped10[0] - coords[0]) + Math.abs(snapped10[1] - coords[1]);
      // At higher resolution, cells are smaller, so snap might be closer
      expect(dist10).toBeLessThanOrEqual(dist9);
    });
  });

  describe('h3Neighbors', () => {
    it('should return neighbors including center', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const neighbors = h3Neighbors(h3Index, 1);
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThan(1);
      expect(neighbors).toContain(h3Index);
    });

    it('should return more cells with larger k', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const neighbors1 = h3Neighbors(h3Index, 1);
      const neighbors2 = h3Neighbors(h3Index, 2);
      expect(neighbors2.length).toBeGreaterThan(neighbors1.length);
    });
  });

  describe('h3ToParent', () => {
    it('should return parent at coarser resolution', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const parent = h3ToParent(h3Index, 8);
      expect(h3GetResolution(parent)).toBe(8);
    });
  });

  describe('h3ToChildren', () => {
    it('should return children at finer resolution', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const children = h3ToChildren(h3Index, 10);
      expect(Array.isArray(children)).toBe(true);
      expect(children.length).toBeGreaterThan(1);
      expect(h3GetResolution(children[0])).toBe(10);
    });
  });

  describe('h3GetResolution', () => {
    it('should return correct resolution', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      expect(h3GetResolution(h3Index)).toBe(9);
    });
  });

  describe('validateH3', () => {
    it('should return true for valid H3 index', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      expect(validateH3(h3Index)).toBe(true);
    });

    it('should return false for invalid H3 index', () => {
      expect(validateH3('invalid')).toBe(false);
      expect(validateH3('')).toBe(false);
    });
  });

  describe('h3AreNeighbors', () => {
    it('should detect neighboring cells', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const neighbors = h3Neighbors(h3Index, 1);
      const neighbor = neighbors.find((n) => n !== h3Index);
      if (neighbor) {
        expect(h3AreNeighbors(h3Index, neighbor)).toBe(true);
      }
    });

    it('should return false for non-neighboring cells', () => {
      const h3Index1 = coordinatesToH3(9)([40.7128, -74.006]);
      const h3Index2 = coordinatesToH3(9)([34.0522, -118.2437]); // LA
      expect(h3AreNeighbors(h3Index1, h3Index2)).toBe(false);
    });
  });

  describe('h3EdgeLength', () => {
    it('should return edge length for resolution', () => {
      const length = h3EdgeLength(9);
      expect(length).toBeGreaterThan(0);
      expect(length).toBeLessThan(1000); // Should be in hundreds of meters
    });

    it('should decrease with higher resolution', () => {
      const length9 = h3EdgeLength(9);
      const length10 = h3EdgeLength(10);
      expect(length10).toBeLessThan(length9);
    });
  });

  describe('h3CellArea', () => {
    it('should return cell area for resolution', () => {
      const area = h3CellArea(9);
      expect(area).toBeGreaterThan(0);
    });

    it('should decrease with higher resolution', () => {
      const area9 = h3CellArea(9);
      const area10 = h3CellArea(10);
      expect(area10).toBeLessThan(area9);
    });
  });

  describe('polygonToH3', () => {
    it('should fill polygon with H3 cells', () => {
      const polygon = {
        type: 'Polygon' as const,
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
      const cells = polygonToH3(polygon, 9);
      expect(Array.isArray(cells)).toBe(true);
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Type-safe functions with branded types
  // ============================================================================

  describe('coordinatesToH3Point (type-safe)', () => {
    it('should convert coordinates to H3Point', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      expect(typeof h3Point).toBe('string');
      expect(h3Point.length).toBeGreaterThan(0);
    });

    it('should use default resolution of 9', () => {
      const h3Point = coordinatesToH3Point()(nyc);
      const resolution = h3GetResolution(h3Point);
      expect(resolution).toBe(9);
    });
  });

  describe('coordinatesToH3Area (type-safe)', () => {
    it('should convert coordinates to H3Area', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      expect(typeof h3Area).toBe('string');
      expect(h3Area.length).toBeGreaterThan(0);
    });
  });

  describe('h3PointToCoordinates (type-safe)', () => {
    it('should convert H3Point to coordinates', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const coords = h3PointToCoordinates(h3Point);
      expect(coords[0]).toBeCloseTo(nyc[0], 2);
      expect(coords[1]).toBeCloseTo(nyc[1], 2);
    });

    it('should roundtrip coordinates', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const coords = h3PointToCoordinates(h3Point);
      const h3Point2 = coordinatesToH3Point(9)(coords);
      expect(h3Point2).toBe(h3Point);
    });
  });

  describe('h3AreaToCoordinates (type-safe)', () => {
    it('should convert H3Area to coordinates', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      const coords = h3AreaToCoordinates(h3Area);
      expect(coords).toHaveLength(2);
      expect(typeof coords[0]).toBe('number');
      expect(typeof coords[1]).toBe('number');
    });
  });

  describe('h3PointToBoundary (type-safe)', () => {
    it('should return cell boundary as polygon', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const boundary = h3PointToBoundary(h3Point);
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThan(0);
      expect(boundary[0]).toHaveLength(2);
    });
  });

  describe('h3AreaToBoundary (type-safe)', () => {
    it('should return cell boundary as polygon', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      const boundary = h3AreaToBoundary(h3Area);
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThan(0);
      expect(boundary[0]).toHaveLength(2);
    });
  });

  describe('h3PointToPolygon (type-safe)', () => {
    it('should return GeoJSON Polygon', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const polygon = h3PointToPolygon(h3Point);
      expect(polygon.type).toBe('Polygon');
      expect(Array.isArray(polygon.coordinates)).toBe(true);
      expect(polygon.coordinates.length).toBe(1);
      expect(polygon.coordinates[0].length).toBeGreaterThan(0);
    });

    it('should match h3ToPolygon result', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const polygon1 = h3PointToPolygon(h3Point);
      const polygon2 = h3ToPolygon(h3Point);
      expect(polygon1.type).toBe(polygon2.type);
      expect(polygon1.coordinates.length).toBe(polygon2.coordinates.length);
    });
  });

  describe('h3AreaToPolygon (type-safe)', () => {
    it('should return GeoJSON Polygon', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      const polygon = h3AreaToPolygon(h3Area);
      expect(polygon.type).toBe('Polygon');
      expect(Array.isArray(polygon.coordinates)).toBe(true);
      expect(polygon.coordinates.length).toBe(1);
      expect(polygon.coordinates[0].length).toBeGreaterThan(0);
    });

    it('should match h3ToPolygon result', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      const polygon1 = h3AreaToPolygon(h3Area);
      const polygon2 = h3ToPolygon(h3Area);
      expect(polygon1.type).toBe(polygon2.type);
      expect(polygon1.coordinates.length).toBe(polygon2.coordinates.length);
    });
  });

  describe('h3PointNeighbors (type-safe)', () => {
    it('should return neighbors including center', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const neighbors = h3PointNeighbors(h3Point, 1);
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThan(1);
      expect(neighbors).toContain(h3Point);
    });

    it('should return more cells with larger k', () => {
      const h3Point = coordinatesToH3Point(9)(nyc);
      const neighbors1 = h3PointNeighbors(h3Point, 1);
      const neighbors2 = h3PointNeighbors(h3Point, 2);
      expect(neighbors2.length).toBeGreaterThan(neighbors1.length);
    });
  });

  describe('h3AreaNeighbors (type-safe)', () => {
    it('should return neighbors including center', () => {
      const h3Area = coordinatesToH3Area(7)(nyc);
      const neighbors = h3AreaNeighbors(h3Area, 1);
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThan(1);
      expect(neighbors).toContain(h3Area);
    });
  });

  describe('h3ResolutionFromZoom', () => {
    it('should map zoom to clamped H3 resolution', () => {
      expect(h3ResolutionFromZoom(12)).toBe(8);
      expect(h3ResolutionFromZoom(2)).toBe(6);
      expect(h3ResolutionFromZoom(23)).toBe(15);
    });

    it('should respect custom min, max, and zoomFactor', () => {
      expect(h3ResolutionFromZoom(10, { min: 0, max: 15, zoomFactor: 1 })).toBe(10);
      expect(h3ResolutionFromZoom(99, { min: 0, max: 9, zoomFactor: 1 })).toBe(9);
    });
  });

  describe('h3DiskToFeatureCollection', () => {
    it('should return a single center feature when k is 0', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const fc = h3DiskToFeatureCollection(h3Index, 0);
      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features).toHaveLength(1);
      expect(fc.features[0]?.properties?.isCenter).toBe(true);
      expect(fc.features[0]?.geometry.type).toBe('Polygon');
    });

    it('should include center and ring cells when k > 0', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const fc = h3DiskToFeatureCollection(h3Index, 2);
      expect(fc.features.length).toBeGreaterThan(1);
      const center = fc.features.find((f) => f.properties?.isCenter);
      expect(center?.properties?.h3Index).toBe(h3Index);
      expect(fc.features.some((f) => f.properties?.isCenter === false)).toBe(true);
    });
  });
  describe('h3SetToMultiPolygon', () => {
    it('should convert array of H3 indices to MultiPolygon', () => {
      const h3Index1 = coordinatesToH3(9)(nyc);
      const h3Index2 = coordinatesToH3(9)([40.713, -74.007]);
      const multiPolygon = h3SetToMultiPolygon([h3Index1, h3Index2]);

      expect(multiPolygon.type).toBe('MultiPolygon');
      expect(Array.isArray(multiPolygon.coordinates)).toBe(true);
      expect(multiPolygon.coordinates.length).toBeGreaterThan(0);
    });

    it('should handle single H3 cell', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const multiPolygon = h3SetToMultiPolygon([h3Index]);

      expect(multiPolygon.type).toBe('MultiPolygon');
      expect(multiPolygon.coordinates.length).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const multiPolygon = h3SetToMultiPolygon([]);
      expect(multiPolygon.type).toBe('MultiPolygon');
      expect(Array.isArray(multiPolygon.coordinates)).toBe(true);
    });

    it('should handle multiple adjacent cells', () => {
      const h3Index = coordinatesToH3(9)(nyc);
      const neighbors = h3Neighbors(h3Index, 1);
      const multiPolygon = h3SetToMultiPolygon([h3Index, ...neighbors]);

      expect(multiPolygon.type).toBe('MultiPolygon');
      expect(multiPolygon.coordinates.length).toBeGreaterThan(0);
    });
  });

  describe('polygonToH3', () => {
    it('should fill polygon with H3 cells', () => {
      const polygon = {
        type: 'Polygon' as const,
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

      const cells = polygonToH3(polygon, 9);
      expect(Array.isArray(cells)).toBe(true);
      expect(cells.length).toBeGreaterThan(0);
      expect(cells.every((cell) => typeof cell === 'string')).toBe(true);
    });

    it('should return empty array for invalid polygon', () => {
      const invalidPolygon = {
        type: 'Polygon' as const,
        coordinates: [],
      };

      const cells = polygonToH3(invalidPolygon, 9);
      expect(Array.isArray(cells)).toBe(true);
    });

    it('should handle different resolutions', () => {
      const polygon = {
        type: 'Polygon' as const,
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

      const cells7 = polygonToH3(polygon, 7);
      const cells9 = polygonToH3(polygon, 9);

      expect(cells7.length).toBeLessThan(cells9.length);
    });

    it('should handle polygon with holes', () => {
      const polygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [-74.01, 40.7],
            [-74.0, 40.7],
            [-74.0, 40.71],
            [-74.01, 40.71],
            [-74.01, 40.7],
          ],
          [
            [-74.005, 40.705],
            [-74.002, 40.705],
            [-74.002, 40.707],
            [-74.005, 40.707],
            [-74.005, 40.705],
          ],
        ],
      };

      const cells = polygonToH3(polygon, 9);
      expect(Array.isArray(cells)).toBe(true);
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
