import Geohash from 'latlon-geohash';
import type { LatLon } from '../types';

/**
 * Encode coordinates to a geohash string
 *
 * @param coordinates - Coordinate pair [lat, lon]
 * @param precision - Length of geohash (default: 10)
 * @returns Geohash string
 *
 * @example
 * ```typescript
 * const hash = encodeGeohash([40.7128, -74.0060], 10);
 * // 'dr5regw3p9'
 * ```
 */
export function encodeGeohash(coordinates: LatLon, precision: number = 10): string {
  const [lat, lon] = coordinates;
  return Geohash.encode(lat, lon, precision);
}
