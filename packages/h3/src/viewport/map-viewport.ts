import type { ViewportBounds } from '../viewport/viewport-bounds.js';

export type { ViewportBounds } from '../viewport/viewport-bounds.js';

/** Approximate WGS84 bounds from map center + zoom (for viewport prefetch before MapLibre is ready). */
export function approximateViewportBoundsFromCenterZoom(
  centerLat: number,
  centerLng: number,
  zoom: number,
  viewportWidthPx = 1024,
  viewportHeightPx = 768
): ViewportBounds {
  const scale = 256 * 2 ** zoom;
  const lngSpan = (360 * viewportWidthPx) / scale;
  const latRadians = (centerLat * Math.PI) / 180;
  const heightLngSpan = (360 * viewportHeightPx) / scale;
  const heightLatSpan = heightLngSpan / Math.max(Math.cos(latRadians), 0.25);
  return {
    west: centerLng - lngSpan / 2,
    east: centerLng + lngSpan / 2,
    south: centerLat - heightLatSpan / 2,
    north: centerLat + heightLatSpan / 2,
  };
}

export function mapViewportBounds(map: {
  getBounds?: () => {
    getWest: () => number;
    getSouth: () => number;
    getEast: () => number;
    getNorth: () => number;
  };
  getCenter?: () => { lat: number; lng: number };
}): { bounds: ViewportBounds; centerLat: number; centerLng: number } | null {
  const boundsApi = map.getBounds?.();
  const center = map.getCenter?.();
  if (!boundsApi || !center) return null;
  return {
    bounds: {
      west: boundsApi.getWest(),
      south: boundsApi.getSouth(),
      east: boundsApi.getEast(),
      north: boundsApi.getNorth(),
    },
    centerLat: center.lat,
    centerLng: center.lng,
  };
}
