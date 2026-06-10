/**
 * Globe CDN DMA — cell bundles + per-market shapes; index math kept for catalog helpers.
 * Auth (Bearer JWT) is supplied by the host app via getRequestInit — no Trustbase here.
 */

import { latLngToCell } from 'h3-js';
import type {
  DmaCatalogEntry,
  DmaRegionBbox,
  DmaRegionClusterIndex,
  ViewportBounds,
  ViewportRegionResolveOptions,
} from '../types/dma';
import { compactH3CellId } from '../utils/h3/cell-id';
import type { CellLayerViewport } from '../utils/h3/viewport';
import { resolveGlobeCdnBaseUrl } from './config';
import { fetchGlobeCdnJson, type GlobeCdnFetchOptions } from './fetch';
import { dmaMarketShapeUrl } from './paths';
import {
  clearCellLayerCache,
  clearCellLayerCatalogCache,
  createCellLayerLoader,
} from './cell-layers';

export type { DmaCatalogEntry, DmaRegionClusterIndex, ViewportRegionResolveOptions };

export type DmaRegionClusterLoaderOptions = GlobeCdnFetchOptions & {
  getRequestInit?: () => RequestInit;
  /** Optional URL rewrite before fetch. */
  resolveUrl?: (url: string) => string;
  onIndexLoaded?: (detail: { regions: number; resolution: number }) => void;
  onIndexUnavailable?: (detail: {
    url: string;
    status?: number;
    reason?: string;
    kind?: string;
    regionId?: string;
  }) => void;
  onShardLoaded?: (detail: { regionId: string }) => void;
  onShardUnavailable?: (detail: { regionId: string; url: string; status?: number }) => void;
  onMerge?: (detail: {
    requestedRegions: number;
    loadedRegions: number;
    fetchedRegions: number;
    features: number;
  }) => void;
};

function normalizeDmaSlug(slug: string | undefined | null): string {
  return (slug ?? '').trim().toLowerCase();
}

function canonicalCellId(h3: string): string {
  return compactH3CellId(h3.trim());
}

export function mergeDmaFeaturesBySlug(
  target: Map<string, GeoJSON.Feature>,
  collection: GeoJSON.FeatureCollection
): number {
  let added = 0;
  for (const feature of collection.features) {
    const slug = normalizeDmaSlug(
      String((feature.properties as { slug?: string })?.slug ?? feature.id ?? '')
    );
    if (!slug || target.has(slug)) continue;
    target.set(slug, feature);
    added += 1;
  }
  return added;
}

export function dmaCatalogEntriesFromRegionIndex(index: DmaRegionClusterIndex): DmaCatalogEntry[] {
  const entries: DmaCatalogEntry[] = [];
  const seen = new Set<string>();

  for (const entry of index.entries) {
    const region = entry.regionId.toLowerCase();
    for (const raw of entry.markets ?? []) {
      const slug = normalizeDmaSlug(raw);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      entries.push({ slug, region });
    }
  }

  return entries;
}

export function dmaRegionBySlugFromRegionIndex(index: DmaRegionClusterIndex): Map<string, string> {
  const regionBySlug = new Map<string, string>();
  for (const { slug, region } of dmaCatalogEntriesFromRegionIndex(index)) {
    if (!regionBySlug.has(slug)) regionBySlug.set(slug, region);
  }
  return regionBySlug;
}

export function dmaSlugsFromRegionIndex(index: DmaRegionClusterIndex): Set<string> {
  return new Set(dmaCatalogEntriesFromRegionIndex(index).map((entry) => entry.slug));
}

export function resolveRegionIdsForSlugs(
  index: DmaRegionClusterIndex,
  marketSlugs: readonly string[]
): string[] {
  const wanted = new Set(marketSlugs.map((slug) => normalizeDmaSlug(slug)).filter(Boolean));
  if (wanted.size === 0) return [];

  const regionIds = new Set<string>();
  for (const entry of index.entries) {
    const markets = entry.markets ?? [];
    if (markets.some((slug) => wanted.has(normalizeDmaSlug(slug)))) {
      regionIds.add(entry.regionId.toLowerCase());
    }
  }
  return [...regionIds].sort();
}

function viewportIntersectsBbox(bounds: ViewportBounds, bbox: DmaRegionBbox): boolean {
  const [west, south, east, north] = bbox;
  return (
    bounds.west <= east && bounds.east >= west && bounds.south <= north && bounds.north >= south
  );
}

export function resolveRegionIdsForViewportBounds(
  index: DmaRegionClusterIndex,
  bounds: ViewportBounds
): string[] {
  const regionIds = new Set<string>();
  for (const entry of index.entries) {
    if (!entry.bbox) continue;
    if (viewportIntersectsBbox(bounds, entry.bbox)) {
      regionIds.add(entry.regionId.toLowerCase());
    }
  }
  return [...regionIds].sort();
}

export function resolveRegionIdsForViewport(
  index: DmaRegionClusterIndex,
  viewportCellIds: readonly string[],
  options?: ViewportRegionResolveOptions & { h3Resolution?: number }
): string[] {
  const map = index.h3CellRegions ?? {};
  const regionIds = new Set<string>();
  for (const raw of viewportCellIds) {
    const cellId = canonicalCellId(raw);
    const region = map[cellId];
    if (region) regionIds.add(region.toLowerCase());
  }
  if (regionIds.size > 0) {
    return [...regionIds].sort();
  }

  if (options?.bounds) {
    const fromBbox = resolveRegionIdsForViewportBounds(index, options.bounds);
    if (fromBbox.length > 0) return fromBbox;
  }

  const resolution = options?.h3Resolution ?? index.resolution;
  if (
    typeof options?.centerLat === 'number' &&
    typeof options?.centerLng === 'number' &&
    Number.isFinite(options.centerLat) &&
    Number.isFinite(options.centerLng)
  ) {
    const centerCell = canonicalCellId(
      latLngToCell(options.centerLat, options.centerLng, resolution)
    );
    const region = map[centerCell];
    if (region) return [region.toLowerCase()];
  }

  return [];
}

export function dmaFeaturesToCollection(
  features: Map<string, GeoJSON.Feature>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...features.values()],
  };
}

/** Clear shared DMA cell-layer cache (all bases when omitted). */
export function clearDmaRegionClusterCache(baseUrl?: string): void {
  clearCellLayerCache(baseUrl);
  clearCellLayerCatalogCache();
}

/** Warm DMA cell bundles for viewport during basemap load. */
export function prefetchDmaRegionsForViewportBounds(
  bounds: ViewportBounds,
  options: DmaRegionClusterLoaderOptions = {}
): void {
  const baseUrl = resolveGlobeCdnBaseUrl(options.baseUrl);
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng = (bounds.east + bounds.west) / 2;
  const loader = createCellLayerLoader({ ...options, baseUrl });
  void loader.loadLayerForViewport({
    viewport: { bounds, centerLat, centerLng, zoom: 4 },
    layer: 'dma',
    target: new Map(),
    getFeatureId: (feature) =>
      normalizeDmaSlug(String((feature.properties as { slug?: string })?.slug ?? feature.id ?? '')),
  });
}

async function loadDmaMarketShapesBySlug(
  marketSlugs: readonly string[],
  target: Map<string, GeoJSON.Feature>,
  options: DmaRegionClusterLoaderOptions
): Promise<{ fetchedRegions: number; addedFeatures: number }> {
  const baseUrl = resolveGlobeCdnBaseUrl(options.baseUrl);
  let addedFeatures = 0;
  const slugs = [...new Set(marketSlugs.map((slug) => normalizeDmaSlug(slug)).filter(Boolean))];
  await Promise.all(
    slugs.map(async (slug) => {
      const url = dmaMarketShapeUrl(baseUrl, slug);
      const resolved = options.resolveUrl?.(url) ?? url;
      try {
        const payload = await fetchGlobeCdnJson<GeoJSON.Feature | GeoJSON.FeatureCollection>(
          resolved,
          {
            baseUrl: options.baseUrl,
            init: options.getRequestInit?.() ?? options.init,
          }
        );
        if (!payload) return;
        if (payload.type === 'FeatureCollection') {
          addedFeatures += mergeDmaFeaturesBySlug(target, payload);
          return;
        }
        if (payload.type === 'Feature') {
          addedFeatures += mergeDmaFeaturesBySlug(target, {
            type: 'FeatureCollection',
            features: [payload],
          });
        }
      } catch {
        options.onShardUnavailable?.({ regionId: slug, url: resolved });
      }
    })
  );
  return { fetchedRegions: 0, addedFeatures };
}

export function createDmaRegionClusterLoader(options: DmaRegionClusterLoaderOptions) {
  const baseUrl = resolveGlobeCdnBaseUrl(options.baseUrl);
  const cellLoader = createCellLayerLoader(options);

  function getCachedIndex(): DmaRegionClusterIndex | null {
    return null;
  }

  function clearCache(): void {
    clearCellLayerCache(baseUrl);
    clearCellLayerCatalogCache();
  }

  async function fetchIndex(): Promise<DmaRegionClusterIndex | null> {
    options.onIndexUnavailable?.({ url: 'legacy regions index removed' });
    return null;
  }

  async function fetchRegionShardGeoJson(
    _regionId: string
  ): Promise<GeoJSON.FeatureCollection | null> {
    return null;
  }

  async function loadFeaturesForRegions(
    _regionIds: readonly string[],
    _target: Map<string, GeoJSON.Feature>
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    return { fetchedRegions: 0, addedFeatures: 0 };
  }

  async function loadFeaturesForSlugs(
    marketSlugs: readonly string[],
    target: Map<string, GeoJSON.Feature>
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    return loadDmaMarketShapesBySlug(marketSlugs, target, options);
  }

  async function loadFeaturesForViewportCells(
    viewport: CellLayerViewport,
    target: Map<string, GeoJSON.Feature>,
    _viewportOptions?: ViewportRegionResolveOptions
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    target.clear();
    const result = await cellLoader.loadLayerForViewport({
      viewport,
      layer: 'dma',
      target,
      getFeatureId: (feature) =>
        normalizeDmaSlug(
          String((feature.properties as { slug?: string })?.slug ?? feature.id ?? '')
        ),
    });
    options.onMerge?.({
      requestedRegions: result.requestedCells,
      loadedRegions: result.loadedCells,
      fetchedRegions: result.loadedCells,
      features: result.features,
    });
    return { fetchedRegions: result.loadedCells, addedFeatures: result.features };
  }

  return {
    getCachedIndex,
    clearCache,
    fetchIndex,
    fetchRegionShardGeoJson,
    loadFeaturesForRegions,
    loadFeaturesForSlugs,
    loadFeaturesForViewportCells,
  };
}

export type DmaRegionClusterLoader = ReturnType<typeof createDmaRegionClusterLoader>;
