import Geohash from 'latlon-geohash';
import type { Bounds } from '../types';

/**
 * Get the bounding box of a geohash
 *
 * @param hash - Geohash string
 * @returns Bounding box [minLon, minLat, maxLon, maxLat]
 *
 * @example
 * ```typescript
 * const bounds = geohashBounds('dr5r');
 * // [-74.01, 40.7, -73.99, 40.72]
 * ```
 */
export function geohashBounds(hash: string): Bounds {
  const { sw, ne } = Geohash.bounds(hash);
  // Return [minLon, minLat, maxLon, maxLat]
  return [sw.lon, sw.lat, ne.lon, ne.lat];
}
