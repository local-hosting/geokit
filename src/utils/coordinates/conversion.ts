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

/**
 * Convert an array of LatLon coordinates to LonLat format
 *
 * @param points - Array of points in [lat, lon] format
 * @returns Array of points in [lon, lat] format
 *
 * @example
 * ```typescript
 * const lonLatCoords = toLonLatArray([
 *   [40.7128, -74.0060],
 *   [34.0522, -118.2437]
 * ]);
 * // [[-74.0060, 40.7128], [-118.2437, 34.0522]]
 * ```
 */
export function toLonLatArray(points: LatLon[]): LonLat[] {
  return points.map(([lat, lon]): LonLat => [lon, lat]);
}

/**
 * Convert an array of LonLat coordinates (GeoJSON format) to LatLon format
 *
 * @param points - Array of points in [lon, lat] format
 * @returns Array of points in [lat, lon] format
 *
 * @example
 * ```typescript
 * const latLonCoords = toLatLonArray([
 *   [-74.0060, 40.7128],
 *   [-118.2437, 34.0522]
 * ]);
 * // [[40.7128, -74.0060], [34.0522, -118.2437]]
 * ```
 */
export function toLatLonArray(points: LonLat[]): LatLon[] {
  return points.map(([lon, lat]): LatLon => [lat, lon]);
}
