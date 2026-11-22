import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

import { viewScopeCells } from './resolve-map-view-scope-cells';

/** Outer `<gk-h3>` / pan-lock cell: saved camera zoom when present, else geokit geo-scope parent. */
export function resolveMapViewScopeOuterCell(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
): string | null {
  return viewScopeCells(geoScopeCell, scopeViewport, viewportSizePx).outer;
}