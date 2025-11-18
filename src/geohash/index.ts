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
export function geohashBounds(hash: string): [number, number, number, number] {
  const { sw, ne } = Geohash.bounds(hash);
  // Return [minLon, minLat, maxLon, maxLat]
  return [sw.lon, sw.lat, ne.lon, ne.lat];
}

/**
 * Get neighboring geohashes
 *
 * @param hash - Geohash string
 * @returns Object with neighboring geohashes in all 8 directions
 *
 * @example
 * ```typescript
 * const neighbors = geohashNeighbors('dr5r');
 * // { n: 'dr5x', ne: 'dr5z', e: 'dr5p', ... }
 * ```
 */
export function geohashNeighbors(hash: string): {
  n: string;
  ne: string;
  e: string;
  se: string;
  s: string;
  sw: string;
  w: string;
  nw: string;
} {
  return Geohash.neighbours(hash);
}

/**
 * Get neighboring geohashes as an array
 *
 * @param hash - Geohash string
 * @returns Array of 8 neighboring geohashes [N, NE, E, SE, S, SW, W, NW]
 *
 * @example
 * ```typescript
 * const neighbors = geohashNeighborsArray('dr5r');
 * // ['dr5x', 'dr5z', 'dr5p', 'dr5n', 'dr5q', 'dr5m', 'dr5j', 'dr5k']
 * ```
 */
export function geohashNeighborsArray(hash: string): string[] {
  const neighbors = Geohash.neighbours(hash);
  return [
    neighbors.n,
    neighbors.ne,
    neighbors.e,
    neighbors.se,
    neighbors.s,
    neighbors.sw,
    neighbors.w,
    neighbors.nw,
  ];
}

/**
 * Get neighboring geohash in a specific direction
 *
 * @param hash - Geohash string
 * @param direction - Direction ('n', 's', 'e', 'w')
 * @returns Neighboring geohash in the specified direction
 *
 * @example
 * ```typescript
 * const north = geohashNeighbor('dr5r', 'n');
 * ```
 */
export function geohashNeighbor(hash: string, direction: 'n' | 's' | 'e' | 'w'): string {
  return Geohash.adjacent(hash, direction);
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
    return decoded.lat >= -90 && decoded.lat <= 90 && decoded.lon >= -180 && decoded.lon <= 180;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use geohashNeighbors instead
 */
export const geohashNeighborsObj = geohashNeighbors;
