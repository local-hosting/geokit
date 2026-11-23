import {
  resolveMapScopeHoverH3Cells,
  resolveMapScopeHoverOuterFromInner,
  type MapScopeHoverH3Cells,
} from '@local-hosting/geokit/h3/map-scope-hover-h3-cells';
import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';

/** Committed map scope overlays — saved inner from locker + matching hover outer parent. */
export function resolveSavedScopeDisplayH3Cells(
  savedGeoScopeCell: string | null | undefined,
  viewport: MapCameraScopeViewport | null | undefined,
  anchorLngLat: readonly [number, number] | null,
): MapScopeHoverH3Cells | null {
  const fromLocker = savedGeoScopeCell?.trim();
  if (fromLocker) {
    try {
      return {
        inner: fromLocker,
        outer: resolveMapScopeHoverOuterFromInner(fromLocker),
      };
    } catch {
      return null;
    }
  }
  if (!viewport || !anchorLngLat) return null;
  try {
    return resolveMapScopeHoverH3Cells(viewport, anchorLngLat);
  } catch {
    return null;
  }
}