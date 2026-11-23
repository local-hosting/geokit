import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

import { resolveSavedScopeDisplayH3Cells } from './resolve-saved-scope-display-h3-cells';

export type ViewScopeCells = {
  inner: string | null;
  outer: string | null;
  source: 'camera' | 'locker-geo-scope' | 'none';
};

/** Pan-lock hover inner + outer at the scope viewport (optional anchor override). */
export function viewScopeCells(
  geoScopeCell: string | null | undefined,
  scopeViewport: MapCameraScopeViewport | null | undefined,
  viewportSizePx?: MapViewportSizePx | null,
  anchorLngLat?: readonly [number, number] | null,
): ViewScopeCells {
  void viewportSizePx;
  if (!scopeViewport) {
    const trimmed = geoScopeCell?.trim();
    if (!trimmed) return { inner: null, outer: null, source: 'none' };
    const fallback = resolveSavedScopeDisplayH3Cells(trimmed, null, null);
    if (!fallback) return { inner: null, outer: null, source: 'none' };
    return { inner: fallback.inner, outer: fallback.outer, source: 'locker-geo-scope' };
  }

  const anchor: readonly [number, number] =
    anchorLngLat ?? [scopeViewport.center[0], scopeViewport.center[1]];

  try {
    const pair = resolveSavedScopeDisplayH3Cells(geoScopeCell, scopeViewport, anchor);
    if (!pair) return { inner: null, outer: null, source: 'none' };
    const source = geoScopeCell?.trim() ? ('locker-geo-scope' as const) : ('camera' as const);
    return { inner: pair.inner, outer: pair.outer, source };
  } catch {
    return { inner: null, outer: null, source: 'none' };
  }
}