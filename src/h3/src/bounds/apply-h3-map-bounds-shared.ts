import type { LngLatBounds as MapMaxBounds } from './map-max-bounds-core';

export type { LngLatBounds as MapMaxBounds } from './map-max-bounds-core';

/** Default `<gk-map min-zoom>` — wide region, not full-globe “outer space”. */
export const GK_MAP_DEFAULT_MIN_ZOOM = 2;

export type MapMaxBoundsZoomCapable = {
  cameraForBounds?: (
    bounds: MapMaxBounds,
    options?: { padding?: number },
  ) => { zoom?: number } | undefined;
};

/** Zoom level at which the viewport exactly fits `maxBounds` (MapLibre navigation uses `minZoom`). */
export function minZoomForMapMaxBounds(
  map: MapMaxBoundsZoomCapable | null | undefined,
  bounds: MapMaxBounds,
  floor = GK_MAP_DEFAULT_MIN_ZOOM,
): number | null {
  const camera = map?.cameraForBounds?.(bounds, { padding: 0 });
  const zoom = camera?.zoom;
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return null;
  return Math.max(floor, Math.round(zoom * 100) / 100);
}

export type ApplyH3GeoScopeMaxBoundsOptions = {
  defaultMinZoom?: number;
};

export type H3MaxBoundsMap = MapMaxBoundsZoomCapable & {
  setMaxBounds?: (bounds: MapMaxBounds | null) => void;
  setMinZoom?: (zoom: number) => void;
};