/**
 * GeoKit contract — map lifecycle, provider ids, bootstrap.
 * Parity Tier 2 with geokit-swift `GeoKitContract` (see docs/module-map.md).
 */

export type { MapStaticProviderId } from '../types/map-provider.js';

export {
  ensureMapReady,
  applyMapTilerSdkConfig,
  type EnsureMapReadyOptions,
  type MapReadyPhaseHandler,
} from '../ui/bootstrap/ensure-map-ready.js';

export {
  STUCK_PLACEHOLDER_MS,
  createPlaceholderContent,
  whenStyleReady,
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
  delayForWebGLRelease,
} from './lifecycle.js';

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
