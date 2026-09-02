import type { ViewportBounds } from '@twinfile/geokit/h3/lite';
import { gridDisk } from 'h3-js';
import {
  compactH3CellId,
  expandH3CellId,
  h3CellsForViewportBounds,
  prioritizeH3CellsNearCenter,
} from '@twinfile/geokit/h3';

export type ViewportH3LoadOptions = {
  bounds: ViewportBounds;
  centerLat: number;
  centerLng: number;
  resolution: number;
  /** Cap shard requests — keeps center cells when tessellation is large. */
  maxCells?: number;
  /** Include k-ring neighbors around viewport cells (default 0). */
  neighborDiskK?: number;
  /** Expand bounds by this fraction on each axis before tessellation. */
  boundsPaddingFraction?: number;
};

function padViewportBounds(
  bounds: ViewportBounds,
  fraction: number
): ViewportBounds {
  if (fraction <= 0) return bounds;
  const latSpan = bounds.north - bounds.south;
  const lngSpan = bounds.east - bounds.west;
  const padLat = latSpan * fraction;
  const padLng = lngSpan * fraction;
  return {
    west: bounds.west - padLng,
    east: bounds.east + padLng,
    south: bounds.south - padLat,
    north: bounds.north + padLat,
  };
}

function expandViewportH3Neighbors(
  core: string[],
  neighborDiskK: number
): string[] {
  if (neighborDiskK <= 0 || core.length === 0) return core;
  const expanded = new Set(core);
  for (const cell of core) {
    try {
      for (const neighbor of gridDisk(expandH3CellId(cell), neighborDiskK)) {
        const compact = compactH3CellId(neighbor);
        if (compact) expanded.add(compact);
      }
    } catch {
      /* skip invalid cell */
    }
  }
  return [...expanded];
}

export function h3CellIdsForViewportLoad(options: ViewportH3LoadOptions): string[] {
  const bounds = padViewportBounds(
    options.bounds,
    options.boundsPaddingFraction ?? 0
  );
  const neighborDiskK = options.neighborDiskK ?? 0;

  const core = [
    ...new Set(
      h3CellsForViewportBounds(bounds, {
        resolution: options.resolution,
        centerLat: options.centerLat,
        centerLng: options.centerLng,
      })
        .map((cell) => compactH3CellId(cell))
        .filter(Boolean)
    ),
  ];

  let cappedCore = core;
  if (options.maxCells != null && core.length > options.maxCells) {
    cappedCore = prioritizeH3CellsNearCenter(
      core,
      options.centerLat,
      options.centerLng,
      options.maxCells
    );
  }

  let expanded = expandViewportH3Neighbors(cappedCore, neighborDiskK);
  if (options.maxCells == null || expanded.length <= options.maxCells) {
    return expanded;
  }

  const coreSet = new Set(cappedCore);
  const haloBudget =
    neighborDiskK > 0
      ? Math.max(8, Math.ceil(options.maxCells * 0.75 * neighborDiskK))
      : 0;
  const maxTotal = options.maxCells + haloBudget;

  if (expanded.length <= maxTotal) {
    return expanded;
  }

  const neighbors = expanded.filter((cell) => !coreSet.has(cell));
  const cappedNeighbors = prioritizeH3CellsNearCenter(
    neighbors,
    options.centerLat,
    options.centerLng,
    Math.max(0, maxTotal - cappedCore.length)
  );
  return [...cappedCore, ...cappedNeighbors];
}

/** Normalize catalog cell id — strip trailing f padding from h3-js indices. */
export function normalizeLoadedCellId(cellId: string): string {
  return compactH3CellId(cellId.trim());
}

export async function loadFeatureCollectionShardsForH3Cells<TId extends string>(options: {
  cellIds: readonly string[];
  target: Map<TId, GeoJSON.Feature>;
  fetchShard: (cellId: string) => Promise<GeoJSON.FeatureCollection | null>;
  getFeatureId: (feature: GeoJSON.Feature) => TId | null;
  onShardMerged?: (detail: { cellId: string; featureCount: number }) => void;
  replace?: boolean;
  /** When set with replace:false, skip cells already present in this set. */
  loadedCellIds?: Set<string>;
}): Promise<{ requestedCells: number; loadedCells: number; features: number }> {
  if (options.replace !== false) {
    options.target.clear();
    options.loadedCellIds?.clear();
  }

  const pendingCellIds = options.loadedCellIds
    ? options.cellIds.filter((cellId) => !options.loadedCellIds!.has(normalizeLoadedCellId(cellId)))
    : [...options.cellIds];

  if (pendingCellIds.length === 0) {
    return {
      requestedCells: options.cellIds.length,
      loadedCells: 0,
      features: options.target.size,
    };
  }

  let loadedCells = 0;
  const results = await Promise.all(pendingCellIds.map((cellId) => options.fetchShard(cellId)));

  for (let index = 0; index < pendingCellIds.length; index += 1) {
    const shard = results[index];
    const cellId = pendingCellIds[index]!;
    if (!shard?.features?.length) continue;
    loadedCells += 1;
    let added = 0;
    for (const feature of shard.features) {
      const id = options.getFeatureId(feature);
      if (!id || options.target.has(id)) continue;
      options.target.set(id, feature);
      added += 1;
    }
    if (added > 0) {
      options.loadedCellIds?.add(normalizeLoadedCellId(cellId));
      options.onShardMerged?.({ cellId, featureCount: added });
    } else if (shard.features.length > 0) {
      options.loadedCellIds?.add(normalizeLoadedCellId(cellId));
    }
  }

  return {
    requestedCells: options.cellIds.length,
    loadedCells,
    features: options.target.size,
  };
}
