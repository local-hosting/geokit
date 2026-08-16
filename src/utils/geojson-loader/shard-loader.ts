import type { ViewportBounds } from '../h3/viewport.js';
import {
  compactH3CellId,
  h3CellsForViewportBounds,
  prioritizeH3CellsNearCenter,
} from '../h3/index.js';

export type ViewportH3LoadOptions = {
  bounds: ViewportBounds;
  centerLat: number;
  centerLng: number;
  resolution: number;
  /** Cap shard requests — keeps center cells when tessellation is large. */
  maxCells?: number;
};

export function h3CellIdsForViewportLoad(options: ViewportH3LoadOptions): string[] {
  const raw = h3CellsForViewportBounds(options.bounds, {
    resolution: options.resolution,
    centerLat: options.centerLat,
    centerLng: options.centerLng,
  }).map((cell) => compactH3CellId(cell));

  const unique = [...new Set(raw.filter(Boolean))];
  if (options.maxCells != null && unique.length > options.maxCells) {
    return prioritizeH3CellsNearCenter(
      unique,
      options.centerLat,
      options.centerLng,
      options.maxCells
    );
  }
  return unique;
}

/** Normalize CDN catalog cell id — strip trailing f padding from h3-js indices. */
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
