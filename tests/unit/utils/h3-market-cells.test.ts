import { describe, expect, it } from 'vitest';
import {
  buildCellToDmaMap,
  buildH2DmaFeatureCollection,
  mergeH2CellFeatures,
  resolveDmaSlugsForViewportCells,
} from '../../../src/utils/h3/market-cells';
import { H3_DMA_UNASSIGNED_SLUG } from '../../../src/types/dma';

describe('geokit/h3 market-cells', () => {
  const marketCells = {
    louisville: ['822a107', '822a117'],
    atlanta: ['822a007'],
  };
  const cellToDma = buildCellToDmaMap(marketCells);

  it('maps compact r2 cells to dma slugs', () => {
    expect(cellToDma.get('822a107')).toBe('louisville');
    expect(cellToDma.get('822a007')).toBe('atlanta');
  });

  it('resolves all dma slugs overlapping viewport cells', () => {
    expect(resolveDmaSlugsForViewportCells(marketCells, ['822a007'])).toEqual(['atlanta']);
  });

  it('builds polygon features per h2 cell', () => {
    const index = { marketCells, cellToDma, dmaSlugs: ['atlanta', 'louisville'] };
    const fc = buildH2DmaFeatureCollection(index, ['822a007'], 2);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.properties?.slug).toBe('atlanta');
  });

  it('fills unassigned viewport cells with grid placeholders', () => {
    const index = { marketCells, cellToDma, dmaSlugs: ['atlanta', 'louisville'] };
    const existing = new Map<string, GeoJSON.Feature<GeoJSON.Polygon>>();
    const fc = mergeH2CellFeatures(existing, index, ['822a007', '822a027'], {
      resolution: 2,
    });
    const grid = fc.features.find((f) => f.properties?.h3 === '822a027');
    expect(grid?.properties?.slug).toBe(H3_DMA_UNASSIGNED_SLUG);
  });
});
