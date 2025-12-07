import type { Geometry } from '../types';

/**
 * Count total number of coordinate points in a geometry
 * Recursively counts all coordinate points in any geometry type
 *
 * @param geometry - GeoJSON Geometry
 * @returns Total number of coordinate points
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]]
 * };
 * const count = countPointsInGeometry(polygon);
 * // 4
 * ```
 */
export function countPointsInGeometry(geometry: Geometry | null | undefined): number {
  if (!geometry || !('coordinates' in geometry)) {
    return 0;
  }

  const count = (coords: unknown): number => {
    if (Array.isArray(coords)) {
      if (typeof coords[0] === 'number') {
        return 1; // Single coordinate
      }
      return coords.reduce((sum, coord) => sum + count(coord), 0);
    }
    return 0;
  };

  return count(geometry.coordinates);
}
