/**
 * Unified H3 cell layer bundles — `/cell/{cellId}.json?layers=county,dma` (client-side filter).
 */

import type {
  CellLayerBundleV1,
  CellLayerCatalogV1,
  CellLayerId,
} from '../types/cell-layers.types.js';
import { globeCellBundleUrl, globeCellLayerCatalogUrl } from './paths.js';
import { resolveGlobeCdnBaseUrl } from './config';
import {
  clearPublishedCellLayerIdsCache,
  fetchGlobeCdnJson,
  syncPublishedCellLayerIds,
  type GlobeCdnFetchOptions,
} from './fetch';
import { resolveGlobeCdnUrl } from './paths';
import { resolvePublishedCellLayerId } from './cell-catalog-alias';
import type { CellLayerViewport, ViewportBounds } from '../utils/h3/viewport';
import { prioritizeH3CellsForViewport, prioritizeH3CellsNearCenter } from '../utils/h3/viewport';
import {
  h3CellIdsForViewportLoad,
  loadFeatureCollectionShardsForH3Cells,
} from './viewport-shard-loader';
import { countyH3ResolutionForZoom, COUNTY_H3_MAX_CELLS } from './county-h3-clusters';
import { compactH3CellId, expandH3CellId } from '../utils/h3/cell-id';
import { cellToBoundary, getResolution } from 'h3-js';

export type { CellLayerBundleV1, CellLayerId };

export type CellLayerBundleRequestDetail = {
  cellId: string;
  url: string;
  layer?: CellLayerId;
  cached?: boolean;
  inflight?: boolean;
};

export type CellLayerBundleRequestHook = (detail: CellLayerBundleRequestDetail) => void;

const cellLayerBundleRequestHooks = new Set<CellLayerBundleRequestHook>();

/** Host apps can observe H3 cell bundle CDN requests. */
export function registerCellLayerBundleRequestHook(hook: CellLayerBundleRequestHook): () => void {
  cellLayerBundleRequestHooks.add(hook);
  return () => cellLayerBundleRequestHooks.delete(hook);
}

function notifyCellLayerBundleRequest(detail: CellLayerBundleRequestDetail): void {
  for (const hook of cellLayerBundleRequestHooks) {
    try {
      hook(detail);
    } catch {
      /* host hook must not break loader */
    }
  }

  const globalHook = (globalThis as { __GEOKIT_CELL_LAYER_REQUEST__?: CellLayerBundleRequestHook })
    .__GEOKIT_CELL_LAYER_REQUEST__;
  if (globalHook) {
    try {
      globalHook(detail);
    } catch {
      /* host hook must not break loader */
    }
  }
}

export type CellLayerLoaderOptions = GlobeCdnFetchOptions & {
  getRequestInit?: () => RequestInit;
  onCellBundleRequest?: CellLayerBundleRequestHook;
};

/** Platform grid resolution — keep in sync with @twinfile/geo PLATFORM_H3_RESOLUTION. */
export const DMA_CELL_LAYER_RESOLUTION = 1;

/** DMA always uses {@link DMA_CELL_LAYER_RESOLUTION}; zoom does not step up resolution. */
export function dmaCellLayerResolutionForZoom(_zoom: number): number {
  return DMA_CELL_LAYER_RESOLUTION;
}

/** DMA fixed r1; county uses zoom ladder (r3 @ z5–11, r4 @ z12+). */
export function cellLayerResolutionForZoom(zoom: number, layer: CellLayerId): number | null {
  if (layer === 'county') {
    return countyH3ResolutionForZoom(zoom);
  }
  return dmaCellLayerResolutionForZoom(zoom);
}

/** Per-viewport shard cap for county layers. */
export const CELL_LAYER_MAX_CELLS: Record<number, number> = {
  ...COUNTY_H3_MAX_CELLS,
};

/** DMA loads use coarse platform cells and allow more shards per viewport. */
export const DMA_CELL_LAYER_MAX_CELLS: Record<number, number> = {
  /** r1 CONUS hero zoom intersects up to ~39 catalog cells on large viewports. */
  1: 40,
  2: 40,
  3: 32,
  4: 48,
};

type CellBundleCache = {
  cachedBundleByCellId: Map<string, CellLayerBundleV1>;
  inflightBundleByCellId: Map<string, Promise<CellLayerBundleV1 | null>>;
  missingBundleByCellId: Set<string>;
};

let cachedCellLayerCatalog: CellLayerCatalogV1 | null | undefined;

let cachedCellLayerCatalogIds: Set<string> | null | undefined;

function canonicalCellLayerCellId(cellId: string): string {
  return compactH3CellId(cellId.trim());
}

function cellIdsFromCatalog(catalog: CellLayerCatalogV1 | null | undefined): Set<string> | null {
  if (!catalog?.cellIds?.length) return null;
  return new Set(catalog.cellIds.map((id: string) => canonicalCellLayerCellId(id)).filter(Boolean));
}

export function filterViewportCellIdsForCatalog(
  catalog: CellLayerCatalogV1 | null | undefined,
  cellIds: readonly string[]
): string[] {
  return publishedCellIds(cellIdsFromCatalog(catalog), cellIds);
}

function catalogCellLayerResolution(catalog: CellLayerCatalogV1 | null | undefined): number | null {
  const sample = catalog?.cellIds?.[0];
  if (!sample) return null;
  try {
    const res = getResolution(expandH3CellId(sample));
    return res >= 0 ? res : null;
  } catch {
    return null;
  }
}

/** Align loader tessellation to sparse CDN tiers (e.g. dma r1 when catalog has [1,3,4]). */
export function catalogResolutionForLayer(
  catalog: CellLayerCatalogV1 | null | undefined,
  layer: CellLayerId,
  preferredResolution: number
): number | null {
  const tiers = catalog?.resolutions?.filter((r: number) => Number.isFinite(r) && r >= 0);
  if (tiers?.length) {
    if (tiers.includes(preferredResolution)) return preferredResolution;
    if (layer === 'dma') {
      return Math.min(...tiers);
    }
    const sorted = [...tiers].sort((a, b) => b - a);
    const atOrBelow = sorted.find((r) => r <= preferredResolution);
    return atOrBelow ?? sorted[sorted.length - 1] ?? null;
  }
  return catalogCellLayerResolution(catalog);
}

function cellBoundsIntersectViewport(cellId: string, bounds: ViewportBounds): boolean {
  try {
    const ring = cellToBoundary(expandH3CellId(cellId), true);
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const [lng, lat] of ring) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }
    return !(
      maxLat < bounds.south ||
      minLat > bounds.north ||
      maxLng < bounds.west ||
      minLng > bounds.east
    );
  } catch {
    return false;
  }
}

/** Sparse CDN index — pick published catalog cells whose centers fall in the viewport. */
export function catalogCellIdsForViewport(
  catalog: CellLayerCatalogV1,
  bounds: ViewportBounds,
  options: {
    layer: CellLayerId;
    preferredResolution: number;
    centerLat: number;
    centerLng: number;
    maxCells?: number;
  }
): string[] {
  const catalogIds = cellIdsFromCatalog(catalog);
  if (!catalogIds?.size) return [];

  const targetRes =
    catalogResolutionForLayer(catalog, options.layer, options.preferredResolution) ??
    options.preferredResolution;

  let candidates = [...catalogIds].filter((cellId) => {
    try {
      return getResolution(expandH3CellId(cellId)) === targetRes;
    } catch {
      return false;
    }
  });

  candidates = candidates.filter((cellId) => cellBoundsIntersectViewport(cellId, bounds));

  if (options.maxCells != null && candidates.length > options.maxCells) {
    if (options.layer === 'dma') {
      candidates = prioritizeH3CellsForViewport(candidates, {
        bounds,
        centerLat: options.centerLat,
        centerLng: options.centerLng,
        limit: options.maxCells,
      });
    } else {
      candidates = prioritizeH3CellsNearCenter(
        candidates,
        options.centerLat,
        options.centerLng,
        options.maxCells
      );
    }
  }

  return candidates;
}

function publishedCellIds(catalogIds: Set<string> | null, cellIds: readonly string[]): string[] {
  if (catalogIds === null || !catalogIds.size) return [];
  const out = new Set<string>();
  for (const raw of cellIds) {
    const published = resolvePublishedCellLayerId(raw, catalogIds);
    if (published) out.add(published);
  }
  return [...out];
}

export function clearCellLayerCatalogCache(): void {
  cachedCellLayerCatalog = undefined;
  cachedCellLayerCatalogIds = undefined;
  clearPublishedCellLayerIdsCache();
}

export async function fetchCellLayerCatalog(
  options: GlobeCdnFetchOptions = {}
): Promise<CellLayerCatalogV1 | null> {
  if (cachedCellLayerCatalog !== undefined) {
    return cachedCellLayerCatalog;
  }
  const baseUrl = resolveGlobeCdnBaseUrl(options.baseUrl);
  const url = resolveGlobeCdnUrl(baseUrl, globeCellLayerCatalogUrl());
  try {
    const catalog = await fetchGlobeCdnJson<CellLayerCatalogV1>(url, options);
    if (catalog?.version !== 1 || !catalog.urlPattern) {
      cachedCellLayerCatalog = null;
      cachedCellLayerCatalogIds = null;
      syncPublishedCellLayerIds(null);
      return null;
    }
    cachedCellLayerCatalog = catalog;
    cachedCellLayerCatalogIds = cellIdsFromCatalog(catalog);
    syncPublishedCellLayerIds(cachedCellLayerCatalogIds);
    return catalog;
  } catch {
    cachedCellLayerCatalog = null;
    cachedCellLayerCatalogIds = null;
    syncPublishedCellLayerIds(null);
    return null;
  }
}

export async function probeCellLayerCatalog(options: GlobeCdnFetchOptions = {}): Promise<boolean> {
  const catalog = await fetchCellLayerCatalog(options);
  return catalog != null && catalog.count > 0;
}

const sharedCacheByBaseUrl = new Map<string, CellBundleCache>();

function cacheKey(baseUrl: string | undefined): string {
  return (baseUrl ?? '').trim().toLowerCase() || '__default__';
}

function getCache(baseUrl: string | undefined): CellBundleCache {
  const key = cacheKey(baseUrl);
  let cache = sharedCacheByBaseUrl.get(key);
  if (!cache) {
    cache = {
      cachedBundleByCellId: new Map(),
      inflightBundleByCellId: new Map(),
      missingBundleByCellId: new Set(),
    };
    sharedCacheByBaseUrl.set(key, cache);
  }
  return cache;
}

export function clearCellLayerCache(baseUrl?: string): void {
  if (baseUrl !== undefined) {
    sharedCacheByBaseUrl.delete(cacheKey(baseUrl));
    return;
  }
  sharedCacheByBaseUrl.clear();
}

export function pickLayersFromBundle(
  bundle: CellLayerBundleV1,
  layers: readonly CellLayerId[]
): GeoJSON.FeatureCollection | null {
  const features: GeoJSON.Feature[] = [];
  for (const layer of layers) {
    const collection = bundle.layers[layer];
    if (collection?.features?.length) {
      features.push(...collection.features);
    }
  }
  if (!features.length) return null;
  return { type: 'FeatureCollection', features };
}

export function createCellLayerLoader(options: CellLayerLoaderOptions = {}) {
  const baseUrl = resolveGlobeCdnBaseUrl(options.baseUrl);
  const cache = getCache(baseUrl);

  function fetchOptions(): GlobeCdnFetchOptions {
    return {
      baseUrl: options.baseUrl,
      init: options.getRequestInit?.() ?? options.init,
    };
  }

  function cellBundleUrl(cellId: string): string {
    return resolveGlobeCdnUrl(baseUrl, globeCellBundleUrl(cellId));
  }

  function emitCellBundleRequest(detail: CellLayerBundleRequestDetail): void {
    notifyCellLayerBundleRequest(detail);
    options.onCellBundleRequest?.(detail);
  }

  async function fetchCellBundle(
    cellId: string,
    context?: { layer?: CellLayerId }
  ): Promise<CellLayerBundleV1 | null> {
    const id = canonicalCellLayerCellId(cellId);
    const catalogIds =
      cachedCellLayerCatalogIds ?? cellIdsFromCatalog(await fetchCellLayerCatalog(fetchOptions()));
    const publishedId = catalogIds?.size ? resolvePublishedCellLayerId(id, catalogIds) : null;
    if (!publishedId) {
      cache.missingBundleByCellId.add(id);
      return null;
    }
    const url = cellBundleUrl(publishedId);
    const cached = cache.cachedBundleByCellId.get(publishedId);
    if (cached) {
      emitCellBundleRequest({ cellId: publishedId, url, layer: context?.layer, cached: true });
      return cached;
    }
    if (cache.missingBundleByCellId.has(id) || cache.missingBundleByCellId.has(publishedId)) {
      return null;
    }

    const inflight = cache.inflightBundleByCellId.get(publishedId);
    if (inflight) {
      emitCellBundleRequest({ cellId: publishedId, url, layer: context?.layer, inflight: true });
      return inflight;
    }

    emitCellBundleRequest({ cellId: publishedId, url, layer: context?.layer });

    const promise = (async () => {
      try {
        const bundle = await fetchGlobeCdnJson<CellLayerBundleV1>(url, fetchOptions());
        if (bundle?.version !== 1 || !bundle.layers) {
          cache.missingBundleByCellId.add(publishedId);
          return null;
        }
        cache.cachedBundleByCellId.set(publishedId, bundle);
        return bundle;
      } catch {
        cache.missingBundleByCellId.add(publishedId);
        return null;
      } finally {
        cache.inflightBundleByCellId.delete(publishedId);
      }
    })();

    cache.inflightBundleByCellId.set(publishedId, promise);
    return promise;
  }

  async function loadLayerForViewport<TId extends string>(options: {
    viewport: CellLayerViewport;
    layer: CellLayerId;
    target: Map<TId, GeoJSON.Feature>;
    getFeatureId: (feature: GeoJSON.Feature) => TId | null;
    onShardMerged?: (detail: { cellId: string; featureCount: number }) => void;
    /** When false, merge new viewport cells without clearing existing features. Default false. */
    replace?: boolean;
    /** Tracks loaded H3 cell ids across viewport pans (used with replace:false). */
    loadedCellIds?: Set<string>;
  }): Promise<{ requestedCells: number; loadedCells: number; features: number }> {
    let resolution = cellLayerResolutionForZoom(options.viewport.zoom, options.layer);
    if (resolution == null) {
      if (options.replace !== false || options.loadedCellIds?.size) {
        options.target.clear();
        options.loadedCellIds?.clear();
      }
      return { requestedCells: 0, loadedCells: 0, features: 0 };
    }

    const catalogForResolution =
      cachedCellLayerCatalog ?? (await fetchCellLayerCatalog(fetchOptions()));
    if (!catalogForResolution?.cellIds?.length) {
      if (options.replace !== false || options.loadedCellIds?.size) {
        options.target.clear();
        options.loadedCellIds?.clear();
      }
      return { requestedCells: 0, loadedCells: 0, features: 0 };
    }

    const catalogRes = catalogResolutionForLayer(catalogForResolution, options.layer, resolution);
    if (catalogRes != null) {
      resolution = catalogRes;
    }

    const maxCells =
      options.layer === 'dma'
        ? DMA_CELL_LAYER_MAX_CELLS[resolution]
        : CELL_LAYER_MAX_CELLS[resolution];

    const cellIds =
      options.layer === 'dma'
        ? catalogCellIdsForViewport(catalogForResolution, options.viewport.bounds, {
            layer: options.layer,
            preferredResolution: resolution,
            centerLat: options.viewport.centerLat,
            centerLng: options.viewport.centerLng,
            maxCells,
          })
        : filterViewportCellIdsForCatalog(
            catalogForResolution,
            h3CellIdsForViewportLoad({
              bounds: options.viewport.bounds,
              centerLat: options.viewport.centerLat,
              centerLng: options.viewport.centerLng,
              resolution,
              maxCells,
            })
          );

    return loadFeatureCollectionShardsForH3Cells({
      cellIds,
      target: options.target,
      fetchShard: async (cellId) => {
        const bundle = await fetchCellBundle(cellId, { layer: options.layer });
        if (!bundle) return null;
        return pickLayersFromBundle(bundle, [options.layer]);
      },
      getFeatureId: options.getFeatureId,
      onShardMerged: options.onShardMerged,
      replace: options.replace ?? false,
      loadedCellIds: options.loadedCellIds,
    });
  }

  return {
    fetchCellBundle,
    fetchCellLayerCatalog,
    loadLayerForViewport,
    cellLayerResolutionForZoom,
  };
}
