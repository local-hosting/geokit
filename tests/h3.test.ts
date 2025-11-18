import { describe, it, expect } from 'vitest';
import {
  coordinatesToH3,
  h3ToCoordinates,
  h3ToBoundary,
  h3Neighbors,
  h3ToParent,
  h3ToChildren,
  h3GetResolution,
  validateH3,
  h3AreNeighbors,
  h3EdgeLength,
  h3CellArea,
  polygonToH3,
} from '../src/h3';

describe('h3', () => {
  const nyc: [number, number] = [40.7128, -74.006];

  describe('coordinatesToH3', () => {
    it('should convert coordinates to H3 index', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      expect(typeof h3Index).toBe('string');
      expect(h3Index.length).toBeGreaterThan(0);
    });

    it('should use default resolution of 9', () => {
      const h3Index = coordinatesToH3(nyc);
      const resolution = h3GetResolution(h3Index);
      expect(resolution).toBe(9);
    });
  });

  describe('h3ToCoordinates', () => {
    it('should convert H3 index to coordinates', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const coords = h3ToCoordinates(h3Index);
      expect(coords[0]).toBeCloseTo(nyc[0], 2);
      expect(coords[1]).toBeCloseTo(nyc[1], 2);
    });

    it('should roundtrip coordinates', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const coords = h3ToCoordinates(h3Index);
      const h3Index2 = coordinatesToH3(coords, 9);
      expect(h3Index2).toBe(h3Index);
    });
  });

  describe('h3ToBoundary', () => {
    it('should return cell boundary as polygon', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const boundary = h3ToBoundary(h3Index);
      expect(Array.isArray(boundary)).toBe(true);
      expect(boundary.length).toBeGreaterThan(0);
      expect(boundary[0]).toHaveLength(2);
    });
  });

  describe('h3Neighbors', () => {
    it('should return neighbors including center', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const neighbors = h3Neighbors(h3Index, 1);
      expect(Array.isArray(neighbors)).toBe(true);
      expect(neighbors.length).toBeGreaterThan(1);
      expect(neighbors).toContain(h3Index);
    });

    it('should return more cells with larger k', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const neighbors1 = h3Neighbors(h3Index, 1);
      const neighbors2 = h3Neighbors(h3Index, 2);
      expect(neighbors2.length).toBeGreaterThan(neighbors1.length);
    });
  });

  describe('h3ToParent', () => {
    it('should return parent at coarser resolution', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const parent = h3ToParent(h3Index, 8);
      expect(h3GetResolution(parent)).toBe(8);
    });
  });

  describe('h3ToChildren', () => {
    it('should return children at finer resolution', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const children = h3ToChildren(h3Index, 10);
      expect(Array.isArray(children)).toBe(true);
      expect(children.length).toBeGreaterThan(1);
      expect(h3GetResolution(children[0])).toBe(10);
    });
  });

  describe('h3GetResolution', () => {
    it('should return correct resolution', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      expect(h3GetResolution(h3Index)).toBe(9);
    });
  });

  describe('validateH3', () => {
    it('should return true for valid H3 index', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      expect(validateH3(h3Index)).toBe(true);
    });

    it('should return false for invalid H3 index', () => {
      expect(validateH3('invalid')).toBe(false);
      expect(validateH3('')).toBe(false);
    });
  });

  describe('h3AreNeighbors', () => {
    it('should detect neighboring cells', () => {
      const h3Index = coordinatesToH3(nyc, 9);
      const neighbors = h3Neighbors(h3Index, 1);
      const neighbor = neighbors.find((n) => n !== h3Index);
      if (neighbor) {
        expect(h3AreNeighbors(h3Index, neighbor)).toBe(true);
      }
    });

    it('should return false for non-neighboring cells', () => {
      const h3Index1 = coordinatesToH3([40.7128, -74.006], 9);
      const h3Index2 = coordinatesToH3([34.0522, -118.2437], 9); // LA
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
});
