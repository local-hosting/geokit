import { maxBoundsFromH3Cell, maxBoundsFromPanLockH3Cell } from './map-max-bounds-core';
import {
  type ApplyH3GeoScopeMaxBoundsOptions,
  type H3MaxBoundsMap,
} from './apply-h3-map-bounds-shared';
import { applyH3MapMaxBoundsToMap } from './apply-h3-map-bounds-runtime';

export {
  GK_MAP_DEFAULT_MAX_ZOOM,
  GK_MAP_DEFAULT_MIN_ZOOM,
  minZoomForMapMaxBounds,
  type ApplyH3GeoScopeMaxBoundsOptions,
  type H3MaxBoundsMap,
  type MapMaxBounds,
  type MapMaxBoundsZoomCapable,
} from './apply-h3-map-bounds-shared';

/** Lock pan/zoom to the padded bounds of a stored geo-scope H3 cell (coarsened for pan). */
export function applyH3GeoScopeMaxBoundsToMap(
  map: H3MaxBoundsMap | null | undefined,
  geoScopeCell: string | null | undefined,
  options: ApplyH3GeoScopeMaxBoundsOptions = {},
): void {
  applyH3MapMaxBoundsToMap(map, geoScopeCell, maxBoundsFromH3Cell, options);
}

/** Lock pan/zoom to an explicit pan-lock H3 cell ({@link panLockH3CellFromMapCamera}). */
export function applyH3PanLockMaxBoundsToMap(
  map: H3MaxBoundsMap | null | undefined,
  panLockCell: string | null | undefined,
  options: ApplyH3GeoScopeMaxBoundsOptions = {},
): void {
  applyH3MapMaxBoundsToMap(map, panLockCell, maxBoundsFromPanLockH3Cell, options);
}