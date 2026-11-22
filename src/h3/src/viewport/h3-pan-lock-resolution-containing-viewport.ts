import { coordinatesToH3, h3GetResolution } from '../geometry/core';
import { h3ToBoundary } from '../geometry/boundary';
import { H3_RESOLUTION_FROM_ZOOM_MAX } from '../geometry/resolution-from-zoom';
import { approximateViewportBoundsFromCenterZoom } from './map-viewport';
import type { MapCameraScopeViewport } from './map-camera-scope-cells';
import type { ViewportBounds } from './viewport-bounds';
import type { MapViewportSizePx } from './map-viewport-h3';

type SizedMapViewportPx = { widthPx: number; heightPx: number };

function readSizedMapViewportPx(size: MapViewportSizePx): SizedMapViewportPx | null {
  const widthPx = size.widthPx;
  const heightPx = size.heightPx;
  if (typeof widthPx !== 'number' || typeof heightPx !== 'number') return null;
  if (!Number.isFinite(widthPx) || !Number.isFinite(heightPx) || widthPx <= 0 || heightPx <= 0) {
    return null;
  }
  return { widthPx, heightPx };
}

function viewportCornerPoints(bounds: ViewportBounds): Array<[number, number]> {
  return [
    [bounds.south, bounds.west],
    [bounds.south, bounds.east],
    [bounds.north, bounds.east],
    [bounds.north, bounds.west],
  ];
}

/** Ray-cast point-in-polygon for a single ring (lat, lng vertices). */
function pointInLatLngRing(lat: number, lng: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!;
    const [yj, xj] = ring[j]!;
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function viewportBoundsContainedInH3CellAtCenter(
  viewport: MapCameraScopeViewport,
  resolution: number,
  size: MapViewportSizePx,
): boolean {
  const sized = readSizedMapViewportPx(size);
  if (!sized) return false;
  const [lng, lat] = viewport.center;
  const bounds = approximateViewportBoundsFromCenterZoom(
    lat,
    lng,
    viewport.zoom,
    sized.widthPx,
    sized.heightPx,
  );
  const cell = coordinatesToH3(resolution)([lat, lng]);
  const ring = h3ToBoundary(cell);
  if (ring.length < 3) return false;
  return viewportCornerPoints(bounds).every(([cornerLat, cornerLng]) =>
    pointInLatLngRing(cornerLat, cornerLng, ring),
  );
}

/**
 * Finest (highest) H3 resolution whose center cell still contains the visible map
 * bounds from center + zoom + canvas size — outer shell sized to the map frame.
 */
export function h3PanLockResolutionContainingViewport(
  viewport: MapCameraScopeViewport,
  size: MapViewportSizePx,
): number {
  const sized = readSizedMapViewportPx(size);
  if (!sized) throw new Error('map viewport width and height required');

  let outerResolution: number | null = null;
  for (let res = 0; res <= H3_RESOLUTION_FROM_ZOOM_MAX; res++) {
    if (!viewportBoundsContainedInH3CellAtCenter(viewport, res, sized)) break;
    outerResolution = res;
  }
  if (outerResolution === null) {
    throw new Error('no h3 resolution contains the map viewport');
  }

  return outerResolution;
}

/** Pan-lock cell at {@link h3PanLockResolutionContainingViewport} for the live map frame. */
export function panLockH3CellContainingMapViewport(
  viewport: MapCameraScopeViewport,
  size: MapViewportSizePx,
): string {
  const resolution = h3PanLockResolutionContainingViewport(viewport, size);
  const [lng, lat] = viewport.center;
  return coordinatesToH3(resolution)([lat, lng]);
}

export function readMapViewportSizePx(map: {
  getCanvas?: () => { width?: number; height?: number };
}): MapViewportSizePx | null {
  const canvas = map.getCanvas?.();
  const widthPx = canvas?.width;
  const heightPx = canvas?.height;
  if (!widthPx || !heightPx || widthPx <= 0 || heightPx <= 0) return null;
  return { widthPx, heightPx };
}