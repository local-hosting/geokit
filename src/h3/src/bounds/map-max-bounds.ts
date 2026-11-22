export {
  MAP_MAX_BOUNDS_BBOX_PAD_FRACTION,
  MAP_MAX_BOUNDS_MIN_PAD_DEGREES,
  MAP_MAX_BOUNDS_COARSEN_STEPS,
  padLngLatBounds,
  h3CellForMapMaxBounds,
  rawMaxBoundsFromH3Cell,
  maxBoundsFromH3Cell,
  rawMaxBoundsFromPanLockH3Cell,
  maxBoundsFromPanLockH3Cell,
  type LngLatBounds,
  type MapMaxBounds,
} from './map-max-bounds-core';

export {
  applyH3GeoScopeMaxBoundsToMap,
  applyH3PanLockMaxBoundsToMap,
  GK_MAP_DEFAULT_MIN_ZOOM,
  minZoomForMapMaxBounds,
  type ApplyH3GeoScopeMaxBoundsOptions,
  type MapMaxBoundsZoomCapable,
} from './apply-h3-map-bounds';