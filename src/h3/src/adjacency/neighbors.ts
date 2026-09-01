import { gridDisk, areNeighborCells } from 'h3-js';

/**
 * Get neighboring H3 cells (k-ring)
 *
 * @param h3Index - H3 cell ID
 * @param k - Ring size (default: 1)
 * @returns Array of H3 cell IDs in the k-ring
 *
 * @example
 * ```typescript
 * const neighbors = h3Neighbors('892a1072c97ffff', 1);
 * // ['892a1072c97ffff', '892a1072c87ffff', ...]
 * ```
 */
export function h3Neighbors(h3Index: string, k: number = 1): string[] {
  return gridDisk(h3Index, k);
}

/**
 * Check if two H3 cells are neighbors
 *
 * @param h3Index1 - First H3 cell ID
 * @param h3Index2 - Second H3 cell ID
 * @returns true if cells are neighbors
 *
 * @example
 * ```typescript
 * const areNeighbors = h3AreNeighbors('892a1072c97ffff', '892a1072c87ffff');
 * ```
 */
export function h3AreNeighbors(h3Index1: string, h3Index2: string): boolean {
  return areNeighborCells(h3Index1, h3Index2);
}
