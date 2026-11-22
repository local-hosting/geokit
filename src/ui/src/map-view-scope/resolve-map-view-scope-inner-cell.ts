import {
  mapCameraScopeH3Cells,
  type MapCameraScopeViewport,
} from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

/** Core `<gk-h3>` cell: inner hex from saved camera when present, else locker geo-scope. */
export function resolveMapViewScopeInnerCell(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
): string | null {
  if (scopeViewport) {
    try {
      return mapCameraScopeH3Cells(scopeViewport, viewportSizePx).inner;
    } catch {
      // fall through to locker geo-scope
    }
  }
  const trimmed = geoScopeCell?.trim();
  return trimmed || null;
}