import type { LatLon } from '../types';

/**
 * Convert decimal degrees to radians
 *
 * @param degrees - Angle in degrees
 * @returns Angle in radians
 *
 * @example
 * ```typescript
 * const rad = toRadians(180); // 3.14159...
 * ```
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to decimal degrees
 *
 * @param radians - Angle in radians
 * @returns Angle in degrees
 *
 * @example
 * ```typescript
 * const deg = toDegrees(Math.PI); // 180
 * ```
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Normalize longitude to -180 to 180 range
 *
 * @param lon - Longitude in degrees
 * @returns Normalized longitude
 *
 * @example
 * ```typescript
 * const normalized = normalizeLongitude(190); // -170
 * ```
 */
export function normalizeLongitude(lon: number): number {
  return ((lon + 540) % 360) - 180;
}

/**
 * Normalize latitude to -90 to 90 range (clamp)
 *
 * @param lat - Latitude in degrees
 * @returns Normalized latitude
 *
 * @example
 * ```typescript
 * const normalized = normalizeLatitude(95); // 90
 * ```
 */
export function normalizeLatitude(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Normalize coordinate pair
 *
 * @param coords - Coordinate pair [lat, lon]
 * @returns Normalized coordinates
 *
 * @example
 * ```typescript
 * const normalized = normalizeCoordinates([95, 190]);
 * // [90, -170]
 * ```
 */
export function normalizeCoordinates(coords: LatLon): LatLon {
  const [lat, lon] = coords;
  return [normalizeLatitude(lat), normalizeLongitude(lon)];
}
