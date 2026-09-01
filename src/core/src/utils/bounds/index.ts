/**
 * Bounds utilities
 * Calculate bounding boxes, centers, and check point containment
 */

export { getBounds } from './get-bounds';
export { getCenter } from './get-center';
export { isWithinBounds } from './is-within-bounds';
export { boundsToObject, type BoundsObject } from './bounds-to-object';
export { bboxToPolygon, bboxToPolygonGeometry } from './bbox-to-polygon';
export { calculateZoomFromBounds, calculateCenterAndZoom } from './calculate-zoom';
export {
  resolveStatesInMapView,
  type MapViewportBounds,
  type StateAbbrResolver,
} from './resolve-states-in-viewport';
export { calculateFitBoundsViewport } from './fit-viewport';
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
} from './map-camera';
