/**
 * Map lifecycle constants and helpers shared with geokit-swift GeoKitContract.
 */

export { STUCK_PLACEHOLDER_MS, createPlaceholderContent } from '../ui/components/elements/map/map-placeholder.js';
export {
  whenStyleReady,
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
  delayForWebGLRelease,
} from '../ui/components/elements/map/map-freeze.js';
