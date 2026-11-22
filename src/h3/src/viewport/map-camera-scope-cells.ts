import { coordinatesToH3 } from '../geometry/core';
import {
  H3_RESOLUTION_FROM_ZOOM_MAX,
  h3PanLockResolutionFromMapZoom,
} from '../geometry/resolution-from-zoom';
import { h3PanLockResolutionContainingViewport } from './h3-pan-lock-resolution-containing-viewport';
import { clampMapScopeH3Resolution } from './map-scope-resolution';
import type { MapViewportSizePx } from './map-viewport-h3';

/** Map viewport anchor in WGS84 (`[lng, lat]` — matches MapLibre camera center). */
export type MapCameraScopeViewport = {
  center: readonly [number, number];
  zoom: number;
};

export type MapCameraScopeH3Cells = { inner: string; outer: string };

/** Finer resolution step for the inner geo-scope hex relative to the outer pan-lock hex. */
export const MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA = 1;

/**
 * Inner (catalog) + outer (pan-lock) hex pair from a map viewport.
 * Inverse of {@link h3CellToMapView} for hosts that save scope from the live camera.
 */
export function mapCameraScopeH3Cells(
  viewport: MapCameraScopeViewport,
  viewportSizePx?: MapViewportSizePx | null,
): MapCameraScopeH3Cells {
  const [lng, lat] = viewport.center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('map camera center required');
  }
  const outerResolution = clampMapScopeH3Resolution(
    resolveMapCameraScopeOuterResolution(viewport, viewportSizePx),
  );
  const innerResolution = mapCameraScopeInnerResolution(outerResolution);
  return {
    outer: coordinatesToH3(outerResolution)([lat, lng]),
    inner: coordinatesToH3(innerResolution)([lat, lng]),
  };
}

/**
 * Catalog inner cell at map click / pointer — same resolution as Save, anchored at lng/lat.
 */
export function mapCameraScopeInnerH3CellAtLngLat(
  viewport: MapCameraScopeViewport,
  lngLat: readonly [number, number],
  viewportSizePx?: MapViewportSizePx | null,
): string {
  const [lng, lat] = lngLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('lng/lat required for inner scope cell');
  }
  const outerResolution = clampMapScopeH3Resolution(
    resolveMapCameraScopeOuterResolution(viewport, viewportSizePx),
  );
  const innerResolution = mapCameraScopeInnerResolution(outerResolution);
  return coordinatesToH3(innerResolution)([lat, lng]);
}

function mapCameraScopeInnerResolution(outerResolution: number): number {
  return Math.min(
    H3_RESOLUTION_FROM_ZOOM_MAX,
    outerResolution + MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA,
  );
}

function resolveMapCameraScopeOuterResolution(
  viewport: MapCameraScopeViewport,
  viewportSizePx?: MapViewportSizePx | null,
): number {
  const zoomResolution = h3PanLockResolutionFromMapZoom(viewport.zoom);
  if (!viewportSizePx) return zoomResolution;
  try {
    return h3PanLockResolutionContainingViewport(viewport, viewportSizePx);
  } catch {
    return zoomResolution;
  }
}

/** Pan-lock outer H3 cell for `gk-h3` / maxBounds (viewport zoom → resolution). */
export function panLockH3CellFromMapCamera(
  viewport: MapCameraScopeViewport,
  viewportSizePx?: MapViewportSizePx | null,
): string {
  return mapCameraScopeH3Cells(viewport, viewportSizePx).outer;
}