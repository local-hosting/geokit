import type { LatLon, LonLat } from '../types';

/**
 * Convert GeoJSON format [lon, lat] to [lat, lon]
 *
 * @param coords - Coordinates in GeoJSON format [longitude, latitude]
 * @returns Coordinates in [latitude, longitude] format
 *
 * @example
 * ```typescript
 * const latLon = toLatLon([-74.0060, 40.7128]); // [40.7128, -74.0060]
 * ```
 */
export function toLatLon(coords: LonLat): LatLon {
  return [coords[1], coords[0]];
}

/**
 * Convert [lat, lon] to GeoJSON format [lon, lat]
 *
 * @param coords - Coordinates in [latitude, longitude] format
 * @returns Coordinates in GeoJSON format [longitude, latitude]
 *
 * @example
 * ```typescript
 * const lonLat = toLonLat([40.7128, -74.0060]); // [-74.0060, 40.7128]
 * ```
 */
export function toLonLat(coords: LatLon): LonLat {
  return [coords[1], coords[0]];
}
