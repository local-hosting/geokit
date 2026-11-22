import { h3ToCoordinates } from '@local-hosting/geokit/h3';
import {
  mapCameraScopeH3Cells,
  type MapCameraScopeViewport,
} from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';
import { h3CellForMapMaxBounds } from '@local-hosting/geokit/h3/map-max-bounds-core';

export type ViewScopeCells = {
  inner: string | null;
  outer: string | null;
  source: 'camera' | 'locker-geo-scope' | 'none';
};

/**
 * Pan-lock outer + catalog inner as one pair — avoids mixing locker geo-scope with viewport outer
 * (which can show the same H3 resolution with unrelated indices).
 */
export function viewScopeCells(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
): ViewScopeCells {
  const trimmed = geoScopeCell?.trim();
  if (scopeViewport) {
    try {
      const { inner: centerInner, outer } = mapCameraScopeH3Cells(scopeViewport, viewportSizePx);
      if (trimmed) {
        const [lat, lng] = h3ToCoordinates(trimmed);
        const lockerOuter = mapCameraScopeH3Cells(
          { center: [lng, lat], zoom: scopeViewport.zoom },
          viewportSizePx,
        ).outer;
        return { inner: trimmed, outer: lockerOuter, source: 'locker-geo-scope' };
      }
      return { inner: centerInner, outer, source: 'camera' };
    } catch {
      // fall through
    }
  }
  if (!trimmed) return { inner: null, outer: null, source: 'none' };
  try {
    return {
      inner: trimmed,
      outer: h3CellForMapMaxBounds(trimmed),
      source: 'locker-geo-scope',
    };
  } catch {
    return { inner: null, outer: null, source: 'none' };
  }
}