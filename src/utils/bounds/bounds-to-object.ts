import type { Bounds } from '../../types';

/**
 * Bounds object format with named properties
 */
export interface BoundsObject {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Convert bounds array to object format
 * Converts [minLon, minLat, maxLon, maxLat] to { minLng, minLat, maxLng, maxLat }
 *
 * @param bounds - Bounding box as [minLon, minLat, maxLon, maxLat]
 * @returns Bounds object with named properties, or null if invalid
 *
 * @example
 * ```typescript
 * const bounds = [-74.0060, 40.7128, -73.9855, 40.7580];
 * const obj = boundsToObject(bounds);
 * // { minLng: -74.0060, minLat: 40.7128, maxLng: -73.9855, maxLat: 40.7580 }
 * ```
 */
export function boundsToObject(bounds: Bounds | null): BoundsObject | null {
  if (!bounds || !Array.isArray(bounds) || bounds.length !== 4) {
    return null;
  }

  const [minLon, minLat, maxLon, maxLat] = bounds;

  if (
    typeof minLon !== 'number' ||
    typeof minLat !== 'number' ||
    typeof maxLon !== 'number' ||
    typeof maxLat !== 'number' ||
    isNaN(minLon) ||
    isNaN(minLat) ||
    isNaN(maxLon) ||
    isNaN(maxLat)
  ) {
    return null;
  }

  return { minLng: minLon, minLat, maxLng: maxLon, maxLat };
}
