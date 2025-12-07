import { cellToParent, cellToChildren } from 'h3-js';

/**
 * Get the parent cell at a coarser resolution
 *
 * @param h3Index - H3 cell ID
 * @param resolution - Target resolution (must be less than current)
 * @returns Parent H3 cell ID
 *
 * @example
 * ```typescript
 * const parent = h3ToParent('892a1072c97ffff', 8);
 * ```
 */
export function h3ToParent(h3Index: string, resolution: number): string {
  return cellToParent(h3Index, resolution);
}

/**
 * Get the children cells at a finer resolution
 *
 * @param h3Index - H3 cell ID
 * @param resolution - Target resolution (must be greater than current)
 * @returns Array of child H3 cell IDs
 *
 * @example
 * ```typescript
 * const children = h3ToChildren('892a1072c97ffff', 10);
 * ```
 */
export function h3ToChildren(h3Index: string, resolution: number): string[] {
  return cellToChildren(h3Index, resolution);
}
