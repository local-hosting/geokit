/**
 * H3 marketCells index — winner-takes-all cell → DMA mapping and choropleth features.
 */

import { h3ToPolygon } from './boundary';
import { compactH3CellId, expandH3CellId } from './cell-id';
import type { DmaMarketCellsIndex } from '../../types/dma';
import { H3_DMA_UNASSIGNED_SLUG } from '../../types/dma';

function normalizeDmaSlug(slug: string | undefined | null): string {
  return (slug ?? '').trim().toLowerCase();
}

export function canonicalH3CellId(h3: string): string {
  return compactH3CellId(h3.trim());
}

export function buildCellToDmaMap(marketCells: Record<string, string[]>): Map<string, string> {
  const dmaCellCounts = new Map<string, number>();
  const cellClaims = new Map<string, string[]>();

  for (const [rawSlug, cells] of Object.entries(marketCells)) {
    const slug = normalizeDmaSlug(rawSlug);
    if (!slug) continue;
    dmaCellCounts.set(slug, cells.length);
    for (const cell of cells) {
      const id = canonicalH3CellId(cell);
      if (!id) continue;
      const claims = cellClaims.get(id) ?? [];
      claims.push(slug);
      cellClaims.set(id, claims);
    }
  }

  const cellToDma = new Map<string, string>();
  for (const [cellId, slugs] of cellClaims) {
    const winner = [...slugs].sort((a, b) => {
      const countDiff = (dmaCellCounts.get(b) ?? 0) - (dmaCellCounts.get(a) ?? 0);
      if (countDiff !== 0) return countDiff;
      return a.localeCompare(b);
    })[0]!;
    cellToDma.set(cellId, winner);
  }
  return cellToDma;
}

export function buildDmaMarketCellsIndex(
  marketCells: Record<string, string[]>
): DmaMarketCellsIndex {
  const cellToDma = buildCellToDmaMap(marketCells);
  return {
    marketCells,
    cellToDma,
    dmaSlugs: Object.keys(marketCells).map(normalizeDmaSlug).filter(Boolean).sort(),
  };
}

export type H3DmaCellFeatureOptions = {
  resolution: number;
  unassignedSlug?: string;
};

function h3DmaCellFeature(
  cellId: string,
  dmaSlug: string,
  resolution: number
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  const geometry = h3ToPolygon(expandH3CellId(cellId));
  if (!geometry) return null;
  return {
    type: 'Feature',
    id: cellId,
    properties: { slug: dmaSlug, h3: cellId, res: resolution },
    geometry,
  };
}

export function collectCellIdsForDmaSlugs(
  index: DmaMarketCellsIndex,
  dmaSlugs: readonly string[]
): string[] {
  const slugSet = new Set(dmaSlugs.map(normalizeDmaSlug).filter(Boolean));
  const cells: string[] = [];
  for (const [cellId, slug] of index.cellToDma) {
    if (slugSet.has(slug)) cells.push(cellId);
  }
  return cells.sort();
}

/** DMA slugs whose marketCells overlap viewport cells (all claimants, not winner-takes-all). */
export function resolveDmaSlugsForViewportCells(
  marketCells: Record<string, string[]>,
  cellIds: readonly string[]
): string[] {
  const wanted = new Set(
    cellIds.map((cell) => canonicalH3CellId(cell)).filter((id): id is string => Boolean(id))
  );
  if (wanted.size === 0) return [];

  const slugs = new Set<string>();
  for (const [rawSlug, cells] of Object.entries(marketCells)) {
    const slug = normalizeDmaSlug(rawSlug);
    if (!slug) continue;
    for (const cell of cells) {
      const id = canonicalH3CellId(cell);
      if (id && wanted.has(id)) {
        slugs.add(slug);
        break;
      }
    }
  }
  return [...slugs].sort();
}

export function buildH2DmaFeatureCollection(
  index: DmaMarketCellsIndex,
  cellIds: readonly string[],
  resolution: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const cellId of cellIds) {
    const canonical = canonicalH3CellId(cellId) ?? cellId;
    const dmaSlug = index.cellToDma.get(canonical);
    if (!dmaSlug) continue;
    const feature = h3DmaCellFeature(canonical, dmaSlug, resolution);
    if (feature) features.push(feature);
  }
  return { type: 'FeatureCollection', features };
}

export function mergeH2CellFeatures(
  existing: Map<string, GeoJSON.Feature<GeoJSON.Polygon>>,
  index: DmaMarketCellsIndex,
  cellIds: readonly string[],
  options?: H3DmaCellFeatureOptions & { includeUnassignedGrid?: boolean }
): GeoJSON.FeatureCollection {
  const resolution = options?.resolution ?? 2;
  const unassignedSlug = options?.unassignedSlug ?? H3_DMA_UNASSIGNED_SLUG;
  const includeUnassignedGrid = options?.includeUnassignedGrid ?? true;

  for (const cellId of cellIds) {
    const canonical = canonicalH3CellId(cellId) ?? cellId;
    if (existing.has(canonical)) continue;

    const dmaSlug = index.cellToDma.get(canonical);
    if (dmaSlug) {
      const feature = h3DmaCellFeature(canonical, dmaSlug, resolution);
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
        slug: unassignedSlug,
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

export type { DmaMarketCellsIndex };
