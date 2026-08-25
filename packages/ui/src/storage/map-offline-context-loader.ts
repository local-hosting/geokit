/**
 * Tier D — host hook: prefetchRegion(bounds) on map context load.
 */

import type {
  MapOfflineCoverage,
  MapOfflineHostContext,
  MapOfflinePrefetchRequest,
} from '@geokit/core/contract/offline';
import {
  defaultOfflineZoomRangeForMap,
  validateOfflinePrefetchRequest,
} from '@geokit/core/contract/offline';
import {
  MapOfflineTileCache,
  type MapOfflinePrefetchOptions,
} from './map-offline-tile-cache';

export interface MapOfflineContextLoaderConfig {
  urlTemplate: string;
  policy?: MapOfflinePrefetchOptions['policy'];
  /** Resolve bounds when a map surface loads (keyed by host `mapId`). */
  resolveContext?: (mapId: string) => MapOfflineHostContext | null | undefined;
}

export type MapOfflineHostPrefetchHook = (
  request: MapOfflinePrefetchRequest,
  options: MapOfflinePrefetchOptions
) => Promise<MapOfflineCoverage>;

function contextKey(mapId: string, bounds: MapOfflineHostContext['bounds']): string {
  return `${mapId}:${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

export class MapOfflineContextLoader {
  private static config: MapOfflineContextLoaderConfig | null = null;
  private static scheduled = new Set<string>();
  private static hostPrefetchHook: MapOfflineHostPrefetchHook | null = null;

  static configure(config: MapOfflineContextLoaderConfig): void {
    MapOfflineContextLoader.config = config;
  }

  static setHostPrefetchHook(hook: MapOfflineHostPrefetchHook | null): void {
    MapOfflineContextLoader.hostPrefetchHook = hook;
  }

  static resetForTesting(): void {
    MapOfflineContextLoader.config = null;
    MapOfflineContextLoader.scheduled.clear();
    MapOfflineContextLoader.hostPrefetchHook = null;
  }

  /** Host-facing Tier D API — prefetch tiles for one map instance. */
  static async prefetchRegion(context: MapOfflineHostContext): Promise<MapOfflineCoverage | null> {
    const config = MapOfflineContextLoader.config;
    if (!config?.urlTemplate) return null;

    const zoomRange =
      context.zoomRange ?? defaultOfflineZoomRangeForMap(12, 'web');
    const request = validateOfflinePrefetchRequest(
      {
        mapId: context.mapId,
        bounds: context.bounds,
        zoomRange,
        providerHint: context.providerHint,
      },
      'web'
    );

    const options: MapOfflinePrefetchOptions = {
      urlTemplate: config.urlTemplate,
      policy: context.policy ?? config.policy ?? 'cacheFirst',
    };

    const key = contextKey(context.mapId, context.bounds);
    if (MapOfflineContextLoader.scheduled.has(key)) {
      return MapOfflineTileCache.getInstance().getCoverage(request, options.urlTemplate, options.policy);
    }
    MapOfflineContextLoader.scheduled.add(key);

    if (MapOfflineContextLoader.hostPrefetchHook) {
      return MapOfflineContextLoader.hostPrefetchHook(request, options);
    }

    return MapOfflineTileCache.getInstance().prefetch(request, options);
  }

  /** Called when a map surface becomes ready (`gk-map-ready`). */
  static async onMapContextLoad(
    mapId: string,
    hints: { zoom?: number; bounds?: MapOfflineHostContext['bounds'] } = {}
  ): Promise<MapOfflineCoverage | null> {
    const config = MapOfflineContextLoader.config;
    if (!config) return null;

    const resolved =
      config.resolveContext?.(mapId) ??
      (hints.bounds
        ? {
            mapId,
            bounds: hints.bounds,
            zoomRange: hints.zoom
              ? defaultOfflineZoomRangeForMap(hints.zoom, 'web')
              : undefined,
          }
        : null);

    if (!resolved) return null;
    return MapOfflineContextLoader.prefetchRegion({
      ...resolved,
      mapId: resolved.mapId || mapId,
      zoomRange:
        resolved.zoomRange ??
        (hints.zoom ? defaultOfflineZoomRangeForMap(hints.zoom, 'web') : undefined),
    });
  }
}
