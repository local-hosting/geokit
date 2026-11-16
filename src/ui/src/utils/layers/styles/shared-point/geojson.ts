/** Shared GeoJSON helpers for shared-point layer sources. */

export const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** GeoJSON source with setData (MapLibre/MapTiler) */
export interface GeoJSONSourceWithSetData {
  setData?(data: GeoJSON.FeatureCollection | GeoJSON.Feature): void;
}

export function extractPointLngLat(geometry: unknown): { lng: number; lat: number } | null {
  if (
    geometry &&
    typeof geometry === 'object' &&
    'type' in geometry &&
    (geometry as { type?: string }).type === 'Point' &&
    'coordinates' in geometry
  ) {
    const coords = (geometry as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        return { lng, lat };
      }
    }
  }
  return null;
}