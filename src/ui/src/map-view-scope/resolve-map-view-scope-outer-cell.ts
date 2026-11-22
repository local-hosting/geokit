import {
  panLockH3CellFromMapCamera,
  type MapCameraScopeViewport,
} from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';
import { h3CellForMapMaxBounds } from '@local-hosting/geokit/h3/map-max-bounds-core';

/** Outer `<gk-h3>` / pan-lock cell: saved camera zoom when present, else geokit geo-scope parent. */
export function resolveMapViewScopeOuterCell(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
): string | null {
  if (scopeViewport) {
    try {
      return panLockH3CellFromMapCamera(scopeViewport, viewportSizePx);
    } catch {
      // fall through to geo-scope parent
    }
  }
  const trimmed = geoScopeCell?.trim();
  if (!trimmed) return null;
  try {
    return h3CellForMapMaxBounds(trimmed);
  } catch {
    return null;
  }
}