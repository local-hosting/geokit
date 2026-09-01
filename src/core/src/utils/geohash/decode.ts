import Geohash from 'latlon-geohash';
import type { LatLon } from '../../types';

/**
 * Decode a geohash string to coordinates
 *
 * @param hash - Geohash string
 * @returns Coordinate pair [lat, lon] (center of geohash box)
 *
 * @example
 * ```typescript
 * const coords = decodeGeohash('dr5regw3p9');
 * // [40.7128, -74.0060]
 * ```
 */
export function decodeGeohash(hash: string): LatLon {
  const { lat, lon } = Geohash.decode(hash);
  return [lat, lon];
}
