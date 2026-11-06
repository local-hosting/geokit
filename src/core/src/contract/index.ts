/**
 * GeoKit contract — offline policy and provider ids.
 * Map storage and bootstrap live in `@twinfile/geokit/ui`.
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
