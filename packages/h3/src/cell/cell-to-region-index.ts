/**
 * H3 marketCells index — winner-takes-all cell → region slug mapping.
 */

import { compactH3CellId, expandH3CellId } from '../cell/cell-id';
import { h3ToPolygon } from '../geometry/boundary';

export type RegionMarketCellsIndex = {
  marketCells: Record<string, string[]>;
  cellToRegion: Map<string, string>;
  regionSlugs: string[];
};

export type RegionCellFeatureOptions = {
  resolution: number;
  unassignedSlug?: string;
  regionProperty?: string;
};

const DEFAULT_UNASSIGNED_SLUG = '__grid__';

export function normalizeRegionSlug(slug: string | undefined | null): string {
  return (slug ?? '').trim().toLowerCase();
}

export function canonicalRegionH3CellId(h3: string): string {
  return compactH3CellId(h3.trim());
}

export function buildCellToRegionMap(
  marketCells: Record<string, string[]>,
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): Map<string, string> {
  const regionCellCounts = new Map<string, number>();
  const cellClaims = new Map<string, string[]>();

  for (const [rawSlug, cells] of Object.entries(marketCells)) {
    const slug = normalizeSlug(rawSlug);
    if (!slug) continue;
    regionCellCounts.set(slug, cells.length);
    for (const cell of cells) {
      const id = canonicalRegionH3CellId(cell);
      if (!id) continue;
      const claims = cellClaims.get(id) ?? [];
      claims.push(slug);
      cellClaims.set(id, claims);
    }
  }

  const cellToRegion = new Map<string, string>();
  for (const [cellId, slugs] of cellClaims) {
    const winner = [...slugs].sort((a, b) => {
      const countDiff = (regionCellCounts.get(b) ?? 0) - (regionCellCounts.get(a) ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.localeCompare(b);
    })[0]!;
    cellToRegion.set(cellId, winner);
  }
  return cellToRegion;
}

export function buildRegionMarketCellsIndex(
  marketCells: Record<string, string[]>,
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): RegionMarketCellsIndex {
  const cellToRegion = buildCellToRegionMap(marketCells, normalizeSlug);
  return {
    marketCells,
    cellToRegion,
    regionSlugs: Object.keys(marketCells)
      .map(normalizeSlug)
      .filter(Boolean)
      .sort(),
  };
}

function regionCellFeature(
  cellId: string,
  regionSlug: string,
  resolution: number,
  regionProperty = 'slug'
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  const geometry = h3ToPolygon(expandH3CellId(cellId));
  if (!geometry) return null;
  return {
    type: 'Feature',
    id: cellId,
    properties: { [regionProperty]: regionSlug, h3: cellId, res: resolution },
    geometry,
  };
}

export function collectCellIdsForRegionSlugs(
  index: RegionMarketCellsIndex,
  regionSlugs: readonly string[],
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): string[] {
  const slugSet = new Set(regionSlugs.map(normalizeSlug).filter(Boolean));
  const cells: string[] = [];
  for (const [cellId, slug] of index.cellToRegion) {
    if (slugSet.has(slug)) cells.push(cellId);
  }
  return cells.sort();
}

export function resolveRegionSlugsForViewportCells(
  marketCells: Record<string, string[]>,
  cellIds: readonly string[],
  normalizeSlug: (slug: string | undefined | null) => string = normalizeRegionSlug
): string[] {
  const wanted = new Set(
    cellIds
      .map(cell => canonicalRegionH3CellId(cell))
      .filter((id): id is string => Boolean(id))
  );
  if (wanted.size === 0) return [];

  const slugs = new Set<string>();
  for (const [rawSlug, cells] of Object.entries(marketCells)) {
    const slug = normalizeSlug(rawSlug);
    if (!slug) continue;
    for (const cell of cells) {
      const id = canonicalRegionH3CellId(cell);
      if (id && wanted.has(id)) {
        slugs.add(slug);
        break;
      }
    }
  }
  return [...slugs].sort();
}

export function buildRegionCellFeatureCollection(
  index: RegionMarketCellsIndex,
  cellIds: readonly string[],
  resolution: number,
  options?: Pick<RegionCellFeatureOptions, 'regionProperty'>
): GeoJSON.FeatureCollection {
  const regionProperty = options?.regionProperty ?? 'slug';
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const cellId of cellIds) {
    const canonical = canonicalRegionH3CellId(cellId) ?? cellId;
    const regionSlug = index.cellToRegion.get(canonical);
    if (!regionSlug) continue;
    const feature = regionCellFeature(canonical, regionSlug, resolution, regionProperty);
    if (feature) features.push(feature);
  }
  return { type: 'FeatureCollection', features };
}

export function mergeRegionCellFeatures(
  existing: Map<string, GeoJSON.Feature<GeoJSON.Polygon>>,
  index: RegionMarketCellsIndex,
  cellIds: readonly string[],
  options?: RegionCellFeatureOptions & { includeUnassignedGrid?: boolean }
): GeoJSON.FeatureCollection {
  const resolution = options?.resolution ?? 1;
  const unassignedSlug = options?.unassignedSlug ?? DEFAULT_UNASSIGNED_SLUG;
  const regionProperty = options?.regionProperty ?? 'slug';
  const includeUnassignedGrid = options?.includeUnassignedGrid ?? true;

  for (const cellId of cellIds) {
    const canonical = canonicalRegionH3CellId(cellId) ?? cellId;
    if (existing.has(canonical)) continue;

    const regionSlug = index.cellToRegion.get(canonical);
    if (regionSlug) {
      const feature = regionCellFeature(canonical, regionSlug, resolution, regionProperty);
      if (feature) existing.set(canonical, feature);
      continue;
    }

    if (!includeUnassignedGrid) continue;
    const geometry = h3ToPolygon(expandH3CellId(canonical));
    if (!geometry) continue;
    existing.set(canonical, {
      type: 'Feature',
      id: canonical,
      properties: {
        [regionProperty]: unassignedSlug,
        h3: canonical,
        res: resolution,
        assigned: false,
      },
      geometry,
    });
  }

  return {
    type: 'FeatureCollection',
    features: [...existing.values()],
  };
}
