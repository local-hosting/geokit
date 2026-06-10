/**
 * Shared viewport → H3 cells → GeoJSON shard fetch + merge.
 */

import type { ViewportBounds } from '../utils/h3/viewport';
import { h3CellsForViewportBounds, prioritizeH3CellsNearCenter } from '../utils/h3/viewport';
import { compactH3CellId } from '../utils/h3/cell-id';

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

/** CDN catalog cell id — strip trailing f padding from h3-js indices. */
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

type MapEventLike = {
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
};

/** Throttled viewport sync — loads during pan (move) and after settle (moveend/zoomend). */
export function bindIncrementalViewportSync(options: {
  map: MapEventLike;
  load: () => void | Promise<void>;
  moveThrottleMs?: number;
  moveEndDebounceMs?: number;
}): () => void {
  const moveThrottleMs = options.moveThrottleMs ?? 200;
  const moveEndDebounceMs = options.moveEndDebounceMs ?? 100;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let loadInflight: Promise<void> | null = null;
  let loadQueued = false;

  const runLoad = (): Promise<void> => {
    if (loadInflight) {
      loadQueued = true;
      return loadInflight;
    }
    loadInflight = (async () => {
      do {
        loadQueued = false;
        await options.load();
      } while (loadQueued);
    })().finally(() => {
      loadInflight = null;
    });
    return loadInflight;
  };

  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void runLoad();
    }, delay);
  };

  const onMove = () => schedule(moveThrottleMs);
  const onSettled = () => schedule(moveEndDebounceMs);

  options.map.on?.('move', onMove);
  options.map.on?.('moveend', onSettled);
  options.map.on?.('zoomend', onSettled);

  void runLoad();

  return () => {
    if (timer) clearTimeout(timer);
    options.map.off?.('move', onMove);
    options.map.off?.('moveend', onSettled);
    options.map.off?.('zoomend', onSettled);
  };
}

/** Debounced moveend-only viewport sync (e.g. place CDN fetches). */
export function bindDebouncedMapMoveend(
  map: MapEventLike,
  load: () => void | Promise<void>,
  debounceMs: number
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void load();
    }, debounceMs);
  };

  map.on?.('moveend', schedule);

  return () => {
    if (timer) clearTimeout(timer);
    map.off?.('moveend', schedule);
  };
}
