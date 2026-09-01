/**
 * GeoKit contract — offline policy, provider ids, local storage.
 * Map bootstrap and surface lifecycle: @geokit/ui or @geokit/core/ui (re-export).
 */

export type { MapStaticProviderId } from '../types/map-provider';

export type {
  MapCameraFrame,
  MapLocalPersistScope,
  MapLocalState,
  MapOfflineBounds,
  MapOfflineZoomRange,
  MapOfflinePolicy,
  MapOfflineRegionStatus,
  MapOfflineStorageBudget,
  MapOfflinePlatform,
  MapOfflinePrefetchRequest,
  MapOfflineContextLoad,
  MapOfflineHostContext,
  MapOfflineTileCoordinate,
  MapOfflineCoverage,
  MapOfflinePolicyErrorCode,
} from './offline';

export {
  MapOfflineDefaults,
  MapOfflinePolicyError,
  validateOfflineBounds,
  defaultOfflineBudget,
  normalizeOfflineZoomRange,
  estimateOfflineTileCount,
  offlineRegionStatus,
  resolveOfflineCoverage,
  validateOfflinePrefetchRequest,
  enumerateOfflineTileCoordinates,
  buildOfflineTileUrl,
  defaultOfflineZoomRangeForMap,
  resolveOfflineBoundsFromPins,
} from './offline';

export { MapLocalStore, type MapSnapshotRecord } from '@geokit/ui/storage/map-local-store';

export { MapOfflineTileCache, TILE_CACHE_NAME } from '@geokit/ui/storage/map-offline-tile-cache';
