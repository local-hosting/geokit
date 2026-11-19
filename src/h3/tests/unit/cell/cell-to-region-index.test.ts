import { describe, expect, it } from 'vitest';
import { latLngToCell } from 'h3-js';
import {
  buildCellToRegionMap,
  buildRegionCellFeatureCollection,
  buildRegionMarketCellsIndex,
  canonicalRegionH3CellId,
  collectCellIdsForRegionSlugs,
  mergeRegionCellFeatures,
  normalizeRegionSlug,
  resolveRegionSlugsForViewportCells,
} from '@local-hosting/geokit/h3/cell-to-region-index';

const RES = 5;
const cellA = latLngToCell(38.24, -85.76, RES);
const cellB = latLngToCell(40.71, -74.0, RES);
const cellC = latLngToCell(34.05, -118.24, RES);

describe('cell-to-region-index', () => {
  describe('normalizeRegionSlug', () => {
    it('lowercases and trims slugs', () => {
      expect(normalizeRegionSlug('  Louisville  ')).toBe('louisville');
      expect(normalizeRegionSlug(null)).toBe('');
    });
  });

  describe('canonicalRegionH3CellId', () => {
    it('compacts padded H3 ids', () => {
      const compact = canonicalRegionH3CellId(cellA);
      expect(compact.endsWith('f')).toBe(false);
      expect(canonicalRegionH3CellId(`${compact}fff`)).toBe(compact);
    });
  });

  describe('buildCellToRegionMap', () => {
    it('assigns winner-takes-all when cells overlap regions', () => {
      const marketCells = {
        Louisville: [cellA, cellB],
        NYC: [cellB, cellC],
      };
      const map = buildCellToRegionMap(marketCells);
      expect(map.get(canonicalRegionH3CellId(cellA))).toBe('louisville');
      expect(map.get(canonicalRegionH3CellId(cellB))).toBe('louisville');
      expect(map.get(canonicalRegionH3CellId(cellC))).toBe('nyc');
    });
  });

  describe('buildRegionMarketCellsIndex', () => {
    it('returns sorted region slugs and cell map', () => {
      const index = buildRegionMarketCellsIndex({
        Louisville: [cellA],
        NYC: [cellB],
      });
      expect(index.regionSlugs).toEqual(['louisville', 'nyc']);
      expect(index.cellToRegion.size).toBe(2);
    });
  });

  describe('collectCellIdsForRegionSlugs', () => {
    it('collects cells assigned to requested slugs', () => {
      const index = buildRegionMarketCellsIndex({
        Louisville: [cellA],
        NYC: [cellB],
      });
      const cells = collectCellIdsForRegionSlugs(index, ['nyc']);
      expect(cells).toEqual([canonicalRegionH3CellId(cellB)]);
    });
  });

  describe('resolveRegionSlugsForViewportCells', () => {
    it('resolves region slugs from viewport cell ids', () => {
      const slugs = resolveRegionSlugsForViewportCells(
        { Louisville: [cellA], NYC: [cellB] },
        [cellA, cellB]
      );
      expect(slugs).toEqual(['louisville', 'nyc']);
    });
  });

  describe('buildRegionCellFeatureCollection', () => {
    it('builds polygon features for assigned cells', () => {
      const index = buildRegionMarketCellsIndex({ Louisville: [cellA] });
      const fc = buildRegionCellFeatureCollection(index, [cellA], RES);
      expect(fc.type).toBe('FeatureCollection');
      expect(fc.features).toHaveLength(1);
      expect(fc.features[0].geometry.type).toBe('Polygon');
      expect(fc.features[0].properties?.slug).toBe('louisville');
    });
  });

  describe('mergeRegionCellFeatures', () => {
    it('merges assigned and unassigned grid cells', () => {
      const index = buildRegionMarketCellsIndex({ Louisville: [cellA] });
      const existing = new Map<string, GeoJSON.Feature<GeoJSON.Polygon>>();
      const fc = mergeRegionCellFeatures(existing, index, [cellA, cellB], {
        resolution: RES,
        includeUnassignedGrid: true,
      });
      expect(fc.features.length).toBeGreaterThanOrEqual(2);
      const unassigned = fc.features.find((f) => f.properties?.assigned === false);
      expect(unassigned).toBeDefined();
    });
  });
});
