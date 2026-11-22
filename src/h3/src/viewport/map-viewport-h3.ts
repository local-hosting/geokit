import { coordinatesToH3 } from '../geometry/core';
import { h3PanLockResolutionFromMapZoom } from '../geometry/resolution-from-zoom';
import { approximateViewportBoundsFromCenterZoom } from './map-viewport';
import type { MapCameraScopeViewport } from './map-camera-scope-cells';
import { h3CellsForViewportBounds } from './viewport';

export type MapViewportSizePx = {
  widthPx?: number;
  heightPx?: number;
};

/** Single H3 cell at the map camera center (default resolution fits one hex to the viewport). */
export function h3CellAtMapCameraCenter(
  viewport: MapCameraScopeViewport,
  resolution = h3PanLockResolutionFromMapZoom(viewport.zoom),
): string {
  const [lng, lat] = viewport.center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('map camera center required');
  }
  return coordinatesToH3(resolution)([lat, lng]);
}

/** H3 cells tessellating the visible map bounds (for multi-hex overlays or prefetch). */
export function h3CellsFillingMapViewport(
  viewport: MapCameraScopeViewport,
  options: MapViewportSizePx & { resolution?: number } = {},
): string[] {
  const [lng, lat] = viewport.center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new Error('map camera center required');
  }
  const resolution = options.resolution ?? h3PanLockResolutionFromMapZoom(viewport.zoom);
  const bounds = approximateViewportBoundsFromCenterZoom(
    lat,
    lng,
    viewport.zoom,
    options.widthPx,
    options.heightPx,
  );
  return h3CellsForViewportBounds(bounds, {
    resolution,
    centerLat: lat,
    centerLng: lng,
  });
}