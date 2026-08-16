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
