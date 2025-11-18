import Geohash from 'latlon-geohash';
import { MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE } from '../constants';

/**
 * Validate a geohash string
 *
 * @param hash - Geohash string to validate
 * @returns true if valid
 *
 * @example
 * ```typescript
 * validateGeohash('dr5r'); // true
 * validateGeohash('invalid!'); // false
 * ```
 */
export function validateGeohash(hash: string): boolean {
  // Must be non-empty string with valid geohash characters (base32: 0-9, b-z excluding a,i,l,o)
  if (!hash || typeof hash !== 'string' || hash.length === 0) {
    return false;
  }

  // Check for invalid characters
  const validChars = /^[0-9b-hjkmnp-z]+$/;
  if (!validChars.test(hash)) {
    return false;
  }

  try {
    const decoded = Geohash.decode(hash);
    // Check if decoded values are in valid ranges
    return (
      decoded.lat >= MIN_LATITUDE &&
      decoded.lat <= MAX_LATITUDE &&
      decoded.lon >= MIN_LONGITUDE &&
      decoded.lon <= MAX_LONGITUDE
    );
  } catch {
    return false;
  }
}

/**
 * Get all geohashes within a bounding box
 * Note: This is a simple implementation that generates geohashes on a grid.
 * For large areas, consider using a more efficient spatial indexing approach.
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param precision - Geohash precision
 * @returns Array of geohashes covering the bounding box
 *
 * @example
 * ```typescript
 * const hashes = geohashesInBounds([-74.01, 40.7, -73.99, 40.72], 5);
 * ```
 */
export function geohashesInBounds(
  bounds: [number, number, number, number],
  precision: number
): string[] {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const hashes = new Set<string>();

  // Generate geohashes on a grid
  // Calculate step size based on precision (rough approximation)
  const steps = Math.min(100, Math.pow(2, precision)); // Limit to prevent excessive computation
  const latStep = (maxLat - minLat) / steps;
  const lonStep = (maxLon - minLon) / steps;

  for (let lat = minLat; lat <= maxLat; lat += latStep) {
    for (let lon = minLon; lon <= maxLon; lon += lonStep) {
      const hash = Geohash.encode(lat, lon, precision);
      hashes.add(hash);
    }
  }

  return Array.from(hashes);
}
