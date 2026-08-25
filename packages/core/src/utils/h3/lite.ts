/**
 * H3 helpers with no h3-js dependency — string ids, map inversion, zoom math, viewport bounds.
 *
 * Import from `@geokit/core/h3/lite` when you do not need lat/lng ↔ cell projection.
 * For full H3 geometry use `@geokit/core/h3`.
 */

export { compactH3CellId, expandH3CellId } from './cell-id.js';
export {
  invertCellMap,
  invertH3ToZips,
  type H3CellMultiMap,
  type H3ToZips,
  type InvertCellMapOptions,
} from './cell-crosswalk-invert.js';
export { unwrapPolygonRingLongitudes } from './unwrap-ring-longitudes.js';
export {
  h3ResolutionFromZoom,
  H3_RESOLUTION_FROM_ZOOM_MIN,
  H3_RESOLUTION_FROM_ZOOM_MAX,
  H3_RESOLUTION_FROM_ZOOM_FACTOR,
  type H3ResolutionFromZoomOptions,
} from './resolution-from-zoom.js';
export type { ViewportBounds } from './viewport-bounds.js';
export {
  approximateViewportBoundsFromCenterZoom,
  mapViewportBounds,
} from './map-viewport.js';
export * from './cell-fade.js';
export * from './cursor-dwell.js';
export * from './session-loaded.js';
