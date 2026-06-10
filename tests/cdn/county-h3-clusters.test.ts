import { describe, expect, it } from 'vitest';
import { countyH3ResolutionForZoom } from '../../src/cdn/county-h3-clusters';
import { h3CellIdsForViewportLoad } from '../../src/cdn/viewport-shard-loader';

describe('countyH3ResolutionForZoom', () => {
  it('returns null below county min zoom', () => {
    expect(countyH3ResolutionForZoom(4)).toBeNull();
  });

  it('uses r3 at z5-11 and r4 at z12+', () => {
    expect(countyH3ResolutionForZoom(5)).toBe(3);
    expect(countyH3ResolutionForZoom(8)).toBe(3);
    expect(countyH3ResolutionForZoom(9)).toBe(3);
    expect(countyH3ResolutionForZoom(11)).toBe(3);
    expect(countyH3ResolutionForZoom(12)).toBe(4);
  });
});

describe('h3CellIdsForViewportLoad', () => {
  it('returns compact cell ids for a viewport', () => {
    const cells = h3CellIdsForViewportLoad({
      bounds: { west: -98.2, south: 29.5, east: -97.0, north: 31.0 },
      centerLat: 30.27,
      centerLng: -97.74,
      resolution: 4,
      maxCells: 12,
    });
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell.length > 0)).toBe(true);
  });
});
