/**
 * Web tile prefetch via Cache API + coverage reporting (Tier C).
 */

import type {
  MapOfflineCoverage,
  MapOfflinePolicy,
  MapOfflinePrefetchRequest,
} from '@geokit/core/contract/offline';
import {
  buildOfflineTileUrl,
  enumerateOfflineTileCoordinates,
  resolveOfflineCoverage,
  validateOfflinePrefetchRequest,
} from '@geokit/core/contract/offline';
import { MapOfflineDefaults } from '@geokit/core/contract/offline';
import {
  OFFLINE_REGIONS_STORE,
  idbDelete,
  idbGet,
  idbGetAll,
  idbPut,
} from './indexed-db';

export const TILE_CACHE_NAME = 'geokit-tiles-v1';
const DEFAULT_CONCURRENCY = 8;

export interface OfflineRegionRecord {
  mapId: string;
  urlTemplate: string;
  bounds: MapOfflinePrefetchRequest['bounds'];
  zoomRange: MapOfflinePrefetchRequest['zoomRange'];
  tilesRequired: number;
  bytesUsed: number;
  updatedAt: number;
}

export interface MapOfflinePrefetchOptions {
  /** Tile URL template with `{z}`, `{x}`, `{y}` placeholders. */
  urlTemplate: string;
  policy?: MapOfflinePolicy;
  signal?: AbortSignal;
  concurrency?: number;
}

export interface MapOfflinePrefetchProgress {
  tilesCached: number;
  tilesRequired: number;
  fractionComplete: number;
}

function requireCaches(): CacheStorage {
  if (typeof caches === 'undefined') {
    throw new Error('Cache API is not available in this environment');
  }
  return caches;
}

async function openTileCache(): Promise<Cache> {
  return requireCaches().open(TILE_CACHE_NAME);
}

async function countCachedTiles(
  urlTemplate: string,
  request: MapOfflinePrefetchRequest
): Promise<{ cached: number; required: number }> {
  const tiles = enumerateOfflineTileCoordinates(request.bounds, request.zoomRange);
  const cache = await openTileCache();
  let cached = 0;
  for (const tile of tiles) {
    const url = buildOfflineTileUrl(urlTemplate, tile);
    const hit = await cache.match(url);
    if (hit) cached += 1;
  }
  return { cached, required: tiles.length };
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined';
}

async function enforceByteBudget(excludeMapId?: string): Promise<void> {
  if (!hasIndexedDB()) return;
  const regions = (await idbGetAll<OfflineRegionRecord>(OFFLINE_REGIONS_STORE))
    .filter((region) => region.mapId !== excludeMapId)
    .sort((a, b) => a.updatedAt - b.updatedAt);
  let totalBytes = regions.reduce((sum, region) => sum + region.bytesUsed, 0);
  const maxBytes = MapOfflineDefaults.webStorageBudget.maxBytes;
  if (totalBytes <= maxBytes) return;
  const cache = await openTileCache();
  for (const region of regions) {
    if (totalBytes <= maxBytes) break;
    const tiles = enumerateOfflineTileCoordinates(region.bounds, region.zoomRange);
    for (const tile of tiles) {
      const url = buildOfflineTileUrl(region.urlTemplate, tile);
      await cache.delete(url);
    }
    await idbDelete(OFFLINE_REGIONS_STORE, region.mapId);
    totalBytes -= region.bytesUsed;
  }
}

export class MapOfflineTileCache {
  private static instance: MapOfflineTileCache | null = null;

  static getInstance(): MapOfflineTileCache {
    if (!MapOfflineTileCache.instance) {
      MapOfflineTileCache.instance = new MapOfflineTileCache();
    }
    return MapOfflineTileCache.instance;
  }

  static resetForTesting(): void {
    MapOfflineTileCache.instance = null;
  }

  async getCoverage(
    request: MapOfflinePrefetchRequest,
    urlTemplate: string,
    policy: MapOfflinePolicy = 'cacheFirst'
  ): Promise<MapOfflineCoverage> {
    const normalized = validateOfflinePrefetchRequest(request, 'web');
    const { cached, required } = await countCachedTiles(urlTemplate, normalized);
    return resolveOfflineCoverage(cached, required, policy);
  }

  async prefetch(
    request: MapOfflinePrefetchRequest,
    options: MapOfflinePrefetchOptions,
    onProgress?: (progress: MapOfflinePrefetchProgress) => void
  ): Promise<MapOfflineCoverage> {
    const normalized = validateOfflinePrefetchRequest(request, 'web');
    const policy = options.policy ?? 'cacheFirst';
    const tiles = enumerateOfflineTileCoordinates(normalized.bounds, normalized.zoomRange);
    const cache = await openTileCache();
    await enforceByteBudget(normalized.mapId);

    let bytesUsed = 0;
    let tilesCached = 0;
    const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    let index = 0;

    const report = () => {
      onProgress?.({
        tilesCached,
        tilesRequired: tiles.length,
        fractionComplete: tiles.length === 0 ? 1 : tilesCached / tiles.length,
      });
    };

    const worker = async () => {
      while (index < tiles.length) {
        if (options.signal?.aborted) return;
        const current = index;
        index += 1;
        const tile = tiles[current];
        const url = buildOfflineTileUrl(options.urlTemplate, tile);
        const existing = await cache.match(url);
        if (existing) {
          tilesCached += 1;
          bytesUsed += Number(existing.headers.get('content-length') ?? 0);
          report();
          continue;
        }
        const response = await fetch(url, { signal: options.signal });
        if (!response.ok) continue;
        const clone = response.clone();
        await cache.put(url, clone);
        tilesCached += 1;
        const length = Number(response.headers.get('content-length') ?? 0);
        bytesUsed += length > 0 ? length : (await response.blob()).size;
        report();
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (hasIndexedDB()) {
      const record: OfflineRegionRecord = {
        mapId: normalized.mapId,
        urlTemplate: options.urlTemplate,
        bounds: normalized.bounds,
        zoomRange: normalized.zoomRange,
        tilesRequired: tiles.length,
        bytesUsed,
        updatedAt: Date.now(),
      };
      await idbPut(OFFLINE_REGIONS_STORE, record);
      await enforceByteBudget();
    }

    return resolveOfflineCoverage(tilesCached, tiles.length, policy);
  }

  async removeRegion(mapId: string): Promise<void> {
    if (!hasIndexedDB()) return;
    const record = await idbGet<OfflineRegionRecord>(OFFLINE_REGIONS_STORE, mapId);
    if (!record) return;
    const cache = await openTileCache();
    const tiles = enumerateOfflineTileCoordinates(record.bounds, record.zoomRange);
    for (const tile of tiles) {
      await cache.delete(buildOfflineTileUrl(record.urlTemplate, tile));
    }
    await idbDelete(OFFLINE_REGIONS_STORE, mapId);
  }

  async clearAll(): Promise<void> {
    if (!hasIndexedDB()) {
      await requireCaches().delete(TILE_CACHE_NAME);
      return;
    }
    const regions = await idbGetAll<OfflineRegionRecord>(OFFLINE_REGIONS_STORE);
    for (const region of regions) {
      await this.removeRegion(region.mapId);
    }
    await requireCaches().delete(TILE_CACHE_NAME);
  }
}
