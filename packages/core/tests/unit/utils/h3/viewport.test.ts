import { describe, expect, it } from 'vitest';
import { gridDisk, latLngToCell } from 'h3-js';
import {
  h3CellsAtPoint,
  h3CellsForViewportBounds,
  h3GridFeatureCollection,
  prioritizeH3CellsForViewport,
  prioritizeH3CellsNearCenter,
} from '../../../../src/utils/h3/viewport.js';

const bounds = {
  west: -74.1,
  south: 40.6,
  east: -73.9,
  north: 40.8,
};

const sampleCells = gridDisk(latLngToCell(40.7, -74.0, 5), 2);

describe('h3 viewport', () => {
  describe('h3CellsForViewportBounds', () => {
    it('returns H3 cells covering a viewport bounds polygon', () => {
      const cells = h3CellsForViewportBounds(bounds, { resolution: 5 });
      expect(cells.length).toBeGreaterThan(0);
    });

    it('returns empty when tessellation exceeds maxEvalCells', () => {
      const denseBounds = {
        west: -75,
        south: 40,
        east: -73,
        north: 41,
      };
      const cells = h3CellsForViewportBounds(denseBounds, { resolution: 7 });
      expect(cells.length).toBeGreaterThan(1);
      const capped = h3CellsForViewportBounds(denseBounds, {
        resolution: 7,
        maxEvalCells: 1,
      });
      expect(capped).toEqual([]);
    });

    it('falls back to grid disk around center when tessellation is empty', () => {
      const tinyBounds = {
        west: 0,
        south: 0,
        east: 0.00001,
        north: 0.00001,
      };
      const cells = h3CellsForViewportBounds(tinyBounds, {
        resolution: 5,
        fallbackDiskK: 1,
      });
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('prioritizeH3CellsNearCenter', () => {
    it('caps cells to the nearest limit around center', () => {
      const limited = prioritizeH3CellsNearCenter(sampleCells, 40.7, -74.0, 3);
      expect(limited).toHaveLength(3);
      expect(limited.every((cell) => sampleCells.includes(cell))).toBe(true);
    });

    it('returns all cells when under the limit', () => {
      const cells = ['a', 'b'];
      expect(prioritizeH3CellsNearCenter(cells, 40.7, -74.0, 5)).toEqual(cells);
    });
  });

  describe('prioritizeH3CellsForViewport', () => {
    it('pins corner cells first then fills toward center', () => {
      const limited = prioritizeH3CellsForViewport(sampleCells, {
        bounds,
        centerLat: 40.7,
        centerLng: -74.0,
        limit: 4,
      });
      expect(limited).toHaveLength(4);
    });
  });

  describe('h3CellsAtPoint', () => {
    it('returns a single cell at a point by default', () => {
      const cells = h3CellsAtPoint(40.7128, -74.006, 7);
      expect(cells).toHaveLength(1);
      expect(cells[0]).toBe(latLngToCell(40.7128, -74.006, 7));
    });

    it('returns a disk when diskK is positive', () => {
      const cells = h3CellsAtPoint(40.7128, -74.006, 7, 1);
      expect(cells.length).toBeGreaterThan(1);
    });
  });

  describe('h3GridFeatureCollection', () => {
    it('builds polygon features with fade opacity properties', () => {
      const cell = latLngToCell(40.7128, -74.006, 7);
      const fc = h3GridFeatureCollection([cell], {
        resolution: 7,
        fillLevels: { new: 0.4, base: 0.1 },
        lineLevels: { new: 0.8, base: 0.3 },
        nowMs: 1_000,
        getLoadedAt: () => 500,
      });
      expect(fc.features).toHaveLength(1);
      expect(fc.features[0].properties?.fillOpacity).toBeDefined();
      expect(fc.features[0].properties?.lineOpacity).toBeDefined();
    });
  });
});
