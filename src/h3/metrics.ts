import { getHexagonEdgeLengthAvg, getHexagonAreaAvg } from 'h3-js';

/**
 * Get the average edge length of H3 cells at a given resolution (in meters)
 *
 * @param resolution - H3 resolution (0-15)
 * @returns Average edge length in meters
 *
 * @example
 * ```typescript
 * const edgeLength = h3EdgeLength(9);
 * // ~174.375668 meters
 * ```
 */
export function h3EdgeLength(resolution: number): number {
  return getHexagonEdgeLengthAvg(resolution, 'm');
}

/**
 * Get the average area of H3 cells at a given resolution (in square meters)
 *
 * @param resolution - H3 resolution (0-15)
 * @returns Average area in square meters
 *
 * @example
 * ```typescript
 * const area = h3CellArea(9);
 * // ~105461.5 square meters
 * ```
 */
export function h3CellArea(resolution: number): number {
  return getHexagonAreaAvg(resolution, 'm2');
}
