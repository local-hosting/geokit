
import type { LatLon } from '../../types';
import { createPointFeature, extractLatLon } from '../turf-utils';
import { turfMidpoint } from '../turf/deps';

/**
 * Calculate the midpoint between two points
 * Uses Turf.js for robust midpoint calculation along a great circle
 *
 * @param point1 - First point [lat, lon]
 * @returns Curried function that takes second point and returns midpoint
 *
 * @example
 * ```typescript
 * const fromNYC = midpoint([40.7128, -74.0060]);
 * const middle = fromNYC([34.0522, -118.2437]); // Midpoint between NYC and LA
 * ```
 */
export function midpoint(point1: LatLon) {
  return (point2: LatLon): LatLon => {
    try {
      const pt1 = createPointFeature(point1);
      const pt2 = createPointFeature(point2);

      const mid = turfMidpoint(pt1, pt2);

      const result = extractLatLon(mid);
      if (result) {
        return result;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: simple average (less accurate but works)
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    return [(lat1 + lat2) / 2, (lon1 + lon2) / 2];
  };
}
