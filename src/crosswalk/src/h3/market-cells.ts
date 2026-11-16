/**
 * Market cell catalog indexing — cell ↔ region slug from published `marketCells` payloads.
 * For static crosswalk table lookups use `convert` / `crosswalk()` instead.
 */

import {
  buildCellToRegionMap,
  buildRegionMarketCellsIndex,
  buildRegionCellFeatureCollection,
  mergeRegionCellFeatures,
  collectCellIdsForRegionSlugs,
  resolveRegionSlugsForViewportCells,
  canonicalRegionH3CellId,
  normalizeRegionSlug,
  type RegionMarketCellsIndex,
  type RegionCellFeatureOptions,
} from '@doppler-group/geokit/h3/cell-to-region-index';

export type {
  RegionMarketCellsIndex,
  RegionCellFeatureOptions,
} from '@doppler-group/geokit/h3/cell-to-region-index';

export {
  buildCellToRegionMap,
  buildRegionMarketCellsIndex,
  buildRegionCellFeatureCollection,
  mergeRegionCellFeatures,
  collectCellIdsForRegionSlugs,
  resolveRegionSlugsForViewportCells,
  canonicalRegionH3CellId,
  normalizeRegionSlug,
} from '@doppler-group/geokit/h3/cell-to-region-index';

/** Winner-takes-all cell → DMA slug map from census-catalog `marketCells`. */
export function buildCellToDmaMap(
  marketCells: Record<string, string[]>,
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): Map<string, string> {
  return buildCellToRegionMap(marketCells, normalizeSlug);
}

/** Compact H3 cell id → DMA slug record (shard keys, crosswalk table export). */
export function buildH3ToDmaMap(
  marketCells: Record<string, string[]>,
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): Record<string, string> {
  const map = buildCellToRegionMap(marketCells, normalizeSlug);
  return Object.fromEntries(map);
}

export type DmaMarketCellsIndex = {
  marketCells: Record<string, string[]>;
  cellToDma: Map<string, string>;
  dmaSlugs: string[];
};

export function buildDmaMarketCellsIndex(
  marketCells: Record<string, string[]>,
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): DmaMarketCellsIndex {
  const index = buildRegionMarketCellsIndex(marketCells, normalizeSlug);
  return {
    marketCells: index.marketCells,
    cellToDma: index.cellToRegion,
    dmaSlugs: index.regionSlugs,
  };
}

export function collectCellIdsForDmaSlugs(
  index: DmaMarketCellsIndex,
  dmaSlugs: readonly string[],
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): string[] {
  return collectCellIdsForRegionSlugs(
    { marketCells: index.marketCells, cellToRegion: index.cellToDma, regionSlugs: index.dmaSlugs },
    dmaSlugs,
    normalizeSlug
  );
}

export function resolveDmaSlugsForViewportCells(
  marketCells: Record<string, string[]>,
  cellIds: readonly string[],
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): string[] {
  return resolveRegionSlugsForViewportCells(marketCells, cellIds, normalizeSlug);
}

export function buildDmaCellFeatureCollection(
  index: DmaMarketCellsIndex,
  cellIds: readonly string[],
  resolution: number,
  options?: Pick<RegionCellFeatureOptions, 'regionProperty'>
): GeoJSON.FeatureCollection {
  return buildRegionCellFeatureCollection(
    { marketCells: index.marketCells, cellToRegion: index.cellToDma, regionSlugs: index.dmaSlugs },
    cellIds,
    resolution,
    options
  );
}

export function mergeDmaCellFeatures(
  existing: Map<string, GeoJSON.Feature<GeoJSON.Polygon>>,
  index: DmaMarketCellsIndex,
  cellIds: readonly string[],
  options?: RegionCellFeatureOptions & { includeUnassignedGrid?: boolean }
): GeoJSON.FeatureCollection {
  return mergeRegionCellFeatures(
    existing,
    { marketCells: index.marketCells, cellToRegion: index.cellToDma, regionSlugs: index.dmaSlugs },
    cellIds,
    options
  );
}
