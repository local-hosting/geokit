import { describe, expect, it } from 'vitest';
import { latLngToCell } from 'h3-js';
import {
  DEFAULT_MAX_H3_HEX_POLYGONS,
  filterCellsInCoverage,
  h3CellToPolygonFeature,
  h3CellsForViewport,
  h3CoveragePolygonCollection,
  viewportCoverageCells,
} from '@doppler-group/geokit/h3';

const bounds = { west: -74.1, south: 40.6, east: -73.9, north: 40.8 };

describe('filterCellsInCoverage', () => {
  it('keeps cells that normalize into the coverage index', () => {
    const res = 7;
    const center = latLngToCell(42.36, -71.06, res);
    const child = latLngToCell(42.361, -71.061, res + 1);
    const filtered = filterCellsInCoverage([child, center], new Set([center]), res);
    expect(filtered).toContain(center);
    expect(filtered.length).toBeGreaterThan(0);
  });
});

describe('viewport coverage helpers', () => {
  it('builds polygon features from H3 cells', () => {
    const center = latLngToCell(40.7, -74.0, 7);
    const feature = h3CellToPolygonFeature(center, {
      properties: (id) => ({ slug: id.slice(0, 4) }),
    });
    expect(feature.type).toBe('Feature');
    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.properties?.h3).toBe(center);
    expect(feature.properties?.slug).toBe(center.slice(0, 4));
  });

  it('tessellates viewport cells and filters by coverage index', () => {
    const res = 5;
    const center = latLngToCell(40.7, -74.0, res);
    const cells = h3CellsForViewport(bounds, res);
    expect(cells.length).toBeGreaterThan(0);

    const covered = viewportCoverageCells(bounds, new Set([center]), res);
    expect(covered.length).toBeGreaterThan(0);
    expect(
      covered.every((cell) => filterCellsInCoverage([cell], new Set([center]), res).length > 0)
    ).toBe(true);
  });

  it('caps polygon collection features', () => {
    const res = 5;
    const cells = h3CellsForViewport(bounds, res);
    const fc = h3CoveragePolygonCollection(cells, { maxFeatures: 2 });
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features.length).toBeLessThanOrEqual(2);
    expect(DEFAULT_MAX_H3_HEX_POLYGONS).toBeGreaterThan(0);
  });
});
