/**
 * Bounds utilities
 * Calculate bounding boxes, centers, and check point containment
 */

export { getBounds } from './get-bounds.js';
export { getCenter } from './get-center.js';
export { isWithinBounds } from './is-within-bounds.js';
export { boundsToObject, type BoundsObject } from './bounds-to-object.js';
export { bboxToPolygon, bboxToPolygonGeometry } from './bbox-to-polygon.js';
export { calculateZoomFromBounds, calculateCenterAndZoom } from './calculate-zoom.js';
export {
  resolveStatesInMapView,
  type MapViewportBounds,
  type StateAbbrResolver,
} from './resolve-states-in-viewport.js';
export { calculateFitBoundsViewport } from './fit-viewport.js';
export {
  DEFAULT_CONTAINED_FRAME_PADDING,
  boundsToLngLatCorners,
  getContainedFrameZoom,
  resolveContainedFrameZoom,
  clampCenterToContainBoundsAtZoom,
  lockMaxZoomToContainedFrame,
  fitMapToContainedBounds,
  focusPointKeepingBoundsVisible,
  type ContainedBoundsMap,
} from './map-camera.js';
