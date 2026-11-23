import { coordinatesToH3, h3GetResolution } from '../geometry/core';
import { h3ToParent } from '../geometry/hierarchy';
import {
  H3_RESOLUTION_FROM_ZOOM_MAX,
  h3PanLockResolutionFromMapZoom,
} from '../geometry/resolution-from-zoom';

import {
  MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA,
  type MapCameraScopeViewport,
} from './map-camera-scope-cells';
import { clampMapScopeH3Resolution } from './map-scope-resolution';

export type MapScopeHoverH3Cells = { inner: string; outer: string };

/** Extra parent step(s) for hover outer below pan-lock zoom curve. */
export const MAP_SCOPE_HOVER_OUTER_COARSEN_STEPS = 1;

/** Resolution gap between saved inner and its hover outer shell. */
export const MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER =
  MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA + MAP_SCOPE_HOVER_OUTER_COARSEN_STEPS;

/** Pan-lock outer (one step coarser) + finer inner at the anchor (live hover + save preview). */
export function resolveMapScopeHoverH3Cells(
  viewport: MapCameraScopeViewport,
  anchorLngLat: readonly [number, number],
): MapScopeHoverH3Cells {
  const [lng, lat] = anchorLngLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('anchor lng/lat required for map scope hover cells');
  }
  const panLock = h3PanLockResolutionFromMapZoom(viewport.zoom);
  const outerResolution = clampMapScopeH3Resolution(
    panLock - MAP_SCOPE_HOVER_OUTER_COARSEN_STEPS,
  );
  const innerResolution = clampMapScopeH3Resolution(
    panLock + MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA,
  );
  return {
    outer: coordinatesToH3(outerResolution)([lat, lng]),
    inner: coordinatesToH3(innerResolution)([lat, lng]),
  };
}

/** Persisted catalog inner — finer step of the hover pair at Save. */
export function resolveMapScopeHoverH3Cell(
  viewport: MapCameraScopeViewport,
  anchorLngLat: readonly [number, number],
): string {
  return resolveMapScopeHoverH3Cells(viewport, anchorLngLat).inner;
}

/** Outer shell for a saved inner — parent one pan-lock step. */
export function resolveMapScopeHoverOuterFromInner(innerCell: string): string {
  const trimmed = innerCell.trim();
  const innerRes = h3GetResolution(trimmed);
  const outerRes = innerRes - MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER;
  if (outerRes < 0) return trimmed;
  return h3ToParent(trimmed, outerRes);
}