/**
 * H3 helpers with no h3-js dependency — string ids, map inversion, zoom math, viewport bounds.
 *
 * Import from `@local-hosting/geokit/h3/lite` when you do not need lat/lng ↔ cell projection.
 * For full H3 geometry use `@local-hosting/geokit/h3`.
 */

export { compactH3CellId, expandH3CellId } from './cell/cell-id';
export {
  invertCellMap,
  invertH3ToZips,
  type H3CellMultiMap,
  type H3ToZips,
  type InvertCellMapOptions,
} from './cell/cell-crosswalk-invert';
export { unwrapPolygonRingLongitudes } from './geometry/unwrap-ring-longitudes';
export {
  h3ResolutionFromZoom,
  H3_RESOLUTION_FROM_ZOOM_MIN,
  H3_RESOLUTION_FROM_ZOOM_MAX,
  H3_RESOLUTION_FROM_ZOOM_FACTOR,
  type H3ResolutionFromZoomOptions,
} from './geometry/resolution-from-zoom';
export type { ViewportBounds } from './viewport/viewport-bounds';
export {
  approximateViewportBoundsFromCenterZoom,
  mapViewportBounds,
} from './viewport/map-viewport';
export * from './cell/cell-fade';
export * from './session/cursor-dwell';
export * from './session/session-loaded';
