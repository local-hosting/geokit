import type { MapCameraScopeViewport } from '@local-hosting/geokit/h3/map-camera-scope-cells';
import type { MapViewportSizePx } from '@local-hosting/geokit/h3/map-viewport-h3';

export type ResolveCommittedMapViewScopeViewportOptions = {
  savedCamera: MapCameraScopeViewport | null | undefined;
  liveCamera: MapCameraScopeViewport | null | undefined;
};

/** Committed viewport on the map — locker-saved camera only (never live tracking). */
export function resolveCommittedMapViewScopeViewport(
  options: ResolveCommittedMapViewScopeViewportOptions,
): MapCameraScopeViewport | null {
  return options.savedCamera ?? null;
}

export type ResolveShowCommittedMapViewScopeOverlaysOptions = {
  savedCamera: MapCameraScopeViewport | null | undefined;
  viewportSizePx?: MapViewportSizePx | null;
};

export function hasMeasuredMapViewport(size: MapViewportSizePx | null | undefined): boolean {
  const widthPx = size?.widthPx;
  const heightPx = size?.heightPx;
  return (
    typeof widthPx === 'number' &&
    typeof heightPx === 'number' &&
    Number.isFinite(widthPx) &&
    Number.isFinite(heightPx) &&
    widthPx > 0 &&
    heightPx > 0
  );
}

/** Blue `gk-h3` overlays: locker-saved scope (always visible when a baseline exists). */
export function resolveShowCommittedMapViewScopeOverlays(
  options: ResolveShowCommittedMapViewScopeOverlaysOptions,
): boolean {
  if (!options.savedCamera) return false;
  return hasMeasuredMapViewport(options.viewportSizePx);
}

export type ResolveTentativeMapViewScopeViewportOptions = {
  savePreviewHover: boolean;
  liveCamera: MapCameraScopeViewport | null | undefined;
};

/** Gray live-scope preview while hovering Save map position. */
export function resolveTentativeMapViewScopeViewport(
  options: ResolveTentativeMapViewScopeViewportOptions,
): MapCameraScopeViewport | null {
  const { savePreviewHover, liveCamera } = options;
  if (!savePreviewHover || !liveCamera) return null;
  return liveCamera;
}