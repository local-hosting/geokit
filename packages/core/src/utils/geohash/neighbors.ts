import Geohash from 'latlon-geohash';

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
 * @deprecated Use geohashNeighbors instead
 */
export const geohashNeighborsObj = geohashNeighbors;
