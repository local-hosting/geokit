/**
 * Map camera utilities — frame bounds with padding, clamp center, cap max zoom.
 * Framework-agnostic; usable by browse cards, MCP hosts, and embedded maps.
 */

import type { Bounds } from '../../types/index.js';

export const DEFAULT_CONTAINED_FRAME_PADDING = 40;

export type ContainedBoundsMap = {
  fitBounds?(
    bounds: [[number, number], [number, number]],
    options?: Record<string, unknown>
  ): void;
  easeTo?(options: Record<string, unknown>): void;
  flyTo?(options: Record<string, unknown>): void;
  getZoom?(): number;
  getMaxZoom?(): number;
  setMaxZoom?(zoom: number): void;
  once?(event: string, handler: () => void): void;
  off?(event: string, handler: () => void): void;
  cameraForBounds?(
    bounds: [[number, number], [number, number]],
    options?: Record<string, unknown>
  ): { center?: [number, number]; zoom?: number } | null | undefined;
};

export function boundsToLngLatCorners(
  bounds: Bounds
): [[number, number], [number, number]] {
  return [
    [bounds[0], bounds[1]],
    [bounds[2], bounds[3]],
  ];
}

export function getContainedFrameZoom(
  map: ContainedBoundsMap,
  containBounds: Bounds,
  padding = DEFAULT_CONTAINED_FRAME_PADDING
): number | null {
  const frame = map.cameraForBounds?.(boundsToLngLatCorners(containBounds), { padding });
  if (typeof frame?.zoom !== 'number' || !Number.isFinite(frame.zoom) || frame.zoom < 0) {
    return null;
  }
  return frame.zoom;
}

export function resolveContainedFrameZoom(
  map: ContainedBoundsMap,
  containBounds: Bounds,
  padding = DEFAULT_CONTAINED_FRAME_PADDING
): number | null {
  const frameZoom = getContainedFrameZoom(map, containBounds, padding);
  const maxZoom = map.getMaxZoom?.();
  if (
    frameZoom != null &&
    typeof maxZoom === 'number' &&
    Number.isFinite(maxZoom) &&
    maxZoom <= frameZoom + 0.01
  ) {
    return maxZoom;
  }
  return frameZoom;
}

/** Clamp map center so viewport at zoom still contains the bounding box. */
export function clampCenterToContainBoundsAtZoom(
  map: ContainedBoundsMap,
  target: { lng: number; lat: number },
  containBounds: Bounds,
  zoom: number,
  padding = DEFAULT_CONTAINED_FRAME_PADDING
): [number, number] {
  const [west, south, east, north] = containBounds;
  const frameZoom = resolveContainedFrameZoom(map, containBounds, padding);
  if (frameZoom == null) {
    return [target.lng, target.lat];
  }

  const latSpan = Math.max(north - south, 1e-6);
  const lonSpan = Math.max(east - west, 1e-6);
  const scale = 2 ** (frameZoom - zoom);
  const halfLon = (lonSpan * scale) / 2;
  const halfLat = (latSpan * scale) / 2;

  if (halfLon * 2 >= lonSpan || halfLat * 2 >= latSpan) {
    return [(west + east) / 2, (south + north) / 2];
  }

  const lng = Math.min(Math.max(target.lng, west + halfLon), east - halfLon);
  const lat = Math.min(Math.max(target.lat, south + halfLat), north - halfLat);
  return [lng, lat];
}

export function lockMaxZoomToContainedFrame(
  map: ContainedBoundsMap,
  containBounds: Bounds,
  padding = DEFAULT_CONTAINED_FRAME_PADDING
): void {
  const frameZoom = getContainedFrameZoom(map, containBounds, padding);
  if (frameZoom != null) {
    map.setMaxZoom?.(frameZoom);
  }
}

/** Fit map to bounds and cap zoom so edges stay visible. */
export function fitMapToContainedBounds(
  map: ContainedBoundsMap,
  bounds: Bounds,
  options?: Record<string, unknown>
): void {
  const padding =
    (options?.padding as number | undefined) ?? DEFAULT_CONTAINED_FRAME_PADDING;
  map.fitBounds?.(boundsToLngLatCorners(bounds), {
    pitch: 0,
    bearing: 0,
    animate: true,
    duration: 1500,
    ...options,
    padding,
  });

  const onMoveEnd = () => {
    const fittedZoom = map.getZoom?.();
    if (typeof fittedZoom === 'number' && Number.isFinite(fittedZoom)) {
      map.setMaxZoom?.(fittedZoom);
    } else {
      lockMaxZoomToContainedFrame(map, bounds, padding);
    }
    map.off?.('moveend', onMoveEnd);
  };
  map.once?.('moveend', onMoveEnd);
}

/** Pan toward a point without zooming past the contained frame. */
export function focusPointKeepingBoundsVisible(
  map: ContainedBoundsMap,
  coords: { lng: number; lat: number },
  containBounds: Bounds | null | undefined,
  options?: { offset?: [number, number]; duration?: number; padding?: number }
): void {
  const duration = options?.duration ?? 800;
  const offset = options?.offset ?? [0, 80];
  const padding = options?.padding ?? DEFAULT_CONTAINED_FRAME_PADDING;
  const currentZoom = map.getZoom?.();
  if (typeof currentZoom !== 'number' || !Number.isFinite(currentZoom)) {
    return;
  }

  let zoom = currentZoom;
  let center: [number, number] = [coords.lng, coords.lat];

  if (containBounds) {
    const frameZoom = resolveContainedFrameZoom(map, containBounds, padding);
    if (frameZoom != null) {
      zoom = Math.min(currentZoom, frameZoom);
    }
    center = clampCenterToContainBoundsAtZoom(map, coords, containBounds, zoom, padding);
  }

  const move = map.easeTo ?? map.flyTo;
  move?.call(map, {
    center,
    zoom,
    offset,
    duration,
    essential: true,
  });
}
