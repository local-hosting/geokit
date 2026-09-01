/**
 * Map lifecycle constants and helpers (parity with geokit-swift GeoKitUI).
 */

export { STUCK_PLACEHOLDER_MS, createPlaceholderContent } from './components/elements/map/style/map-placeholder';
export {
  whenStyleReady,
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
  delayForWebGLRelease,
} from './components/elements/map/lifecycle/map-freeze';
