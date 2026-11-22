import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

import { viewScopeCells } from './resolve-map-view-scope-cells';

/** Core `<gk-h3>` cell: inner hex from saved camera when present, else locker geo-scope. */
export function resolveMapViewScopeInnerCell(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
): string | null {
  return viewScopeCells(geoScopeCell, scopeViewport, viewportSizePx).inner;
}