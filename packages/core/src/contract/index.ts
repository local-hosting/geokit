/**
 * GeoKit contract — offline policy, provider ids, local storage.
 * Map bootstrap and surface lifecycle: @geokit/ui or @geokit/core/ui (re-export).
 */

export type { MapStaticProviderId } from '../types/map-provider.js';

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
} from './offline.js';

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
} from './offline.js';

export { MapLocalStore, type MapSnapshotRecord } from '../storage/map-local-store.js';

export { MapOfflineTileCache, TILE_CACHE_NAME } from '../storage/map-offline-tile-cache.js';
