import type { LatLon } from '../../types';
import {
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  LONGITUDE_NORMALIZATION_OFFSET,
  DEGREES_IN_CIRCLE,
  MIN_LATITUDE,
  MAX_LATITUDE,
} from '../../constants';

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
  return degrees * DEGREES_TO_RADIANS;
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
  return radians * RADIANS_TO_DEGREES;
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
  return ((lon + LONGITUDE_NORMALIZATION_OFFSET) % DEGREES_IN_CIRCLE) - 180;
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
  return Math.max(MIN_LATITUDE, Math.min(MAX_LATITUDE, lat));
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
