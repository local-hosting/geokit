import Geohash from 'latlon-geohash';
import type { LatLon } from '../../types';

/**
 * Encode coordinates to a geohash string (curried)
 *
 * @param precision - Length of geohash (default: 10)
 * @returns Curried function that takes coordinates and returns geohash string
 *
 * @example
 * ```typescript
 * const encode10 = encodeGeohash(10);
 * const hash = encode10([40.7128, -74.0060]);
 * // 'dr5regw3p9'
 *
 * // Or use with map
 * const hashes = coordinates.map(encodeGeohash(7));
 * ```
 */
export function encodeGeohash(precision: number = 10) {
  return (coordinates: LatLon): string => {
    const [lat, lon] = coordinates;
    return Geohash.encode(lat, lon, precision);
  };
}
