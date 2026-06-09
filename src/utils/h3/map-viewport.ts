import type { ViewportBounds } from './viewport';

export type { ViewportBounds };

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
