/**
 * Globe CDN DMA regional shards — pure index math + injectable fetch loader.
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
import { dmaRegionIndexUrl, dmaRegionShardUrl } from './paths';
import { fetchGlobeCdn, type GlobeCdnFetchOptions } from './fetch';

export type { DmaCatalogEntry, DmaRegionClusterIndex, ViewportRegionResolveOptions };

export type DmaRegionClusterLoaderOptions = GlobeCdnFetchOptions & {
  getRequestInit?: () => RequestInit;
  /** Rewrite URL before fetch (e.g. dev proxy). */
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
  if (options?.bounds) {
    const fromBbox = resolveRegionIdsForViewportBounds(index, options.bounds);
    if (fromBbox.length > 0) return fromBbox;
  }

  const map = index.h3CellRegions ?? {};
  const hasBbox = index.entries.some((entry) => entry.bbox);
  const resolution = options?.h3Resolution ?? index.resolution;

  if (
    !hasBbox &&
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

  const regionIds = new Set<string>();
  for (const raw of viewportCellIds) {
    const cellId = canonicalCellId(raw);
    const region = map[cellId];
    if (region) regionIds.add(region.toLowerCase());
  }
  return [...regionIds].sort();
}

export function dmaFeaturesToCollection(
  features: Map<string, GeoJSON.Feature>
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...features.values()],
  };
}

export function createDmaRegionClusterLoader(options: DmaRegionClusterLoaderOptions) {
  const baseUrl = options.baseUrl;
  let cachedIndex: DmaRegionClusterIndex | null = null;
  let indexInflight: Promise<DmaRegionClusterIndex | null> | null = null;
  const cachedRegionShardById = new Map<string, GeoJSON.FeatureCollection>();
  const inflightRegionShardById = new Map<string, Promise<GeoJSON.FeatureCollection | null>>();
  const missingRegionShardById = new Set<string>();

  function fetchOptions(): GlobeCdnFetchOptions {
    return {
      baseUrl: options.baseUrl,
      init: options.getRequestInit?.() ?? options.init,
    };
  }

  async function fetchJson<T>(
    url: string,
    meta?: { kind?: string; regionId?: string }
  ): Promise<T | null> {
    const resolved = options.resolveUrl?.(url) ?? url;
    try {
      const res = await fetchGlobeCdn(resolved, fetchOptions());
      if (!res.ok) {
        if (res.status === 401) {
          options.onIndexUnavailable?.({
            url: resolved,
            status: res.status,
            ...(meta ?? {}),
            reason: 'unauthorized — set Bearer JWT via getRequestInit',
          });
        } else if (meta?.kind === 'dma-region-shard') {
          options.onShardUnavailable?.({
            regionId: meta.regionId ?? '',
            url: resolved,
            status: res.status,
          });
        } else {
          options.onIndexUnavailable?.({ url: resolved, status: res.status });
        }
        return null;
      }
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('text/html')) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  function getCachedIndex(): DmaRegionClusterIndex | null {
    return cachedIndex;
  }

  function clearCache(): void {
    cachedIndex = null;
    indexInflight = null;
    cachedRegionShardById.clear();
    inflightRegionShardById.clear();
    missingRegionShardById.clear();
  }

  async function fetchIndex(): Promise<DmaRegionClusterIndex | null> {
    if (cachedIndex) return cachedIndex;
    if (indexInflight) return indexInflight;

    indexInflight = (async () => {
      const url = dmaRegionIndexUrl(baseUrl ?? '');
      try {
        const index = await fetchJson<DmaRegionClusterIndex>(url, { kind: 'dma-region-index' });
        if (!index?.entries?.length) {
          options.onIndexUnavailable?.({ url });
          return null;
        }
        cachedIndex = index;
        options.onIndexLoaded?.({
          regions: index.entries.length,
          resolution: index.resolution,
        });
        return index;
      } catch {
        options.onIndexUnavailable?.({ url });
        return null;
      } finally {
        indexInflight = null;
      }
    })();

    return indexInflight;
  }

  async function fetchRegionShardGeoJson(
    regionId: string
  ): Promise<GeoJSON.FeatureCollection | null> {
    const id = regionId.trim().toLowerCase();
    if (!id) return null;

    const cached = cachedRegionShardById.get(id);
    if (cached) return cached;

    const inflight = inflightRegionShardById.get(id);
    if (inflight) return inflight;

    const promise = (async () => {
      const url = dmaRegionShardUrl(baseUrl ?? '', id);
      try {
        const geojson = await fetchJson<GeoJSON.FeatureCollection>(url, {
          kind: 'dma-region-shard',
          regionId: id,
        });
        if (geojson?.type !== 'FeatureCollection' || !geojson.features?.length) {
          missingRegionShardById.add(id);
          options.onShardUnavailable?.({ regionId: id, url });
          return null;
        }
        cachedRegionShardById.set(id, geojson);
        options.onShardLoaded?.({ regionId: id });
        return geojson;
      } catch {
        options.onShardUnavailable?.({ regionId: id, url });
        return null;
      } finally {
        inflightRegionShardById.delete(id);
      }
    })();

    inflightRegionShardById.set(id, promise);
    return promise;
  }

  async function loadFeaturesForRegions(
    regionIds: readonly string[],
    target: Map<string, GeoJSON.Feature>,
    loadOptions?: {
      filterSlugs?: readonly string[];
      index?: DmaRegionClusterIndex | null;
    }
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    const unique = [...new Set(regionIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
    if (unique.length === 0) {
      return { fetchedRegions: 0, addedFeatures: 0 };
    }

    const index = loadOptions?.index ?? (await fetchIndex());
    if (!index?.entries?.length) {
      return { fetchedRegions: 0, addedFeatures: 0 };
    }

    const known = new Set(index.entries.map((entry) => entry.regionId.toLowerCase()));
    const toLoad = unique.filter((id) => known.has(id));
    const toFetch = toLoad.filter(
      (id) => !cachedRegionShardById.has(id) && !missingRegionShardById.has(id)
    );

    let fetchedRegions = 0;
    await Promise.all(
      toFetch.map(async (regionId) => {
        const geojson = await fetchRegionShardGeoJson(regionId);
        if (geojson) fetchedRegions += 1;
      })
    );

    let addedFeatures = 0;
    for (const regionId of toLoad) {
      const cached = cachedRegionShardById.get(regionId);
      if (!cached) continue;
      if (loadOptions?.filterSlugs) {
        const wanted = new Set(
          loadOptions.filterSlugs.map((slug) => normalizeDmaSlug(slug)).filter(Boolean)
        );
        const filtered: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: cached.features.filter((feature) => {
            const slug = normalizeDmaSlug(
              String((feature.properties as { slug?: string })?.slug ?? feature.id ?? '')
            );
            return slug && wanted.has(slug);
          }),
        };
        addedFeatures += mergeDmaFeaturesBySlug(target, filtered);
      } else {
        addedFeatures += mergeDmaFeaturesBySlug(target, cached);
      }
    }

    options.onMerge?.({
      requestedRegions: unique.length,
      loadedRegions: toLoad.length,
      fetchedRegions,
      features: target.size,
    });

    return { fetchedRegions, addedFeatures };
  }

  async function loadFeaturesForSlugs(
    marketSlugs: readonly string[],
    target: Map<string, GeoJSON.Feature>
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    const slugs = [...new Set(marketSlugs.map((slug) => normalizeDmaSlug(slug)).filter(Boolean))];
    if (slugs.length === 0) {
      return { fetchedRegions: 0, addedFeatures: 0 };
    }

    const index = await fetchIndex();
    if (!index?.entries?.length) {
      return { fetchedRegions: 0, addedFeatures: 0 };
    }

    const regionIds = resolveRegionIdsForSlugs(index, slugs);
    return loadFeaturesForRegions(regionIds, target, {
      filterSlugs: slugs,
      index,
    });
  }

  async function loadFeaturesForViewportCells(
    viewportCellIds: readonly string[],
    target: Map<string, GeoJSON.Feature>,
    viewportOptions?: ViewportRegionResolveOptions
  ): Promise<{ fetchedRegions: number; addedFeatures: number }> {
    const index = await fetchIndex();
    if (!index?.entries?.length) {
      target.clear();
      return { fetchedRegions: 0, addedFeatures: 0 };
    }
    const regionIds = resolveRegionIdsForViewport(index, viewportCellIds, viewportOptions);
    target.clear();
    return loadFeaturesForRegions(regionIds, target, { index });
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
