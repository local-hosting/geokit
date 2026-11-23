/** Map viewport → inner/outer `gk-h3` scope cells (re-exported from geokit H3). */
export {
  MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA,
  mapCameraScopeH3Cells,
  panLockH3CellFromMapCamera,
  type MapCameraScopeH3Cells,
  type MapCameraScopeViewport,
} from '@local-hosting/geokit/h3/map-camera-scope-cells';

export {
  resolveMapScopeHoverH3Cell,
  resolveMapScopeHoverH3Cells,
  resolveMapScopeHoverOuterFromInner,
  type MapScopeHoverH3Cells,
} from '@local-hosting/geokit/h3/map-scope-hover-h3-cells';

export {
  h3CellAtMapCameraCenter,
  h3CellsFillingMapViewport,
  type MapViewportSizePx,
} from '@local-hosting/geokit/h3/map-viewport-h3';