import turfMidpoint from '@turf/midpoint';
import { point as turfPoint } from '@turf/helpers';
import type { LatLon } from '../types';

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
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      // Convert to Turf format [lon, lat]
      const pt1 = turfPoint([lon1, lat1]);
      const pt2 = turfPoint([lon2, lat2]);

      const mid = turfMidpoint(pt1, pt2);

      // Type-safe extraction
      if (
        mid.geometry.type === 'Point' &&
        Array.isArray(mid.geometry.coordinates) &&
        mid.geometry.coordinates.length >= 2
      ) {
        const [lon, lat] = mid.geometry.coordinates;
        if (typeof lon === 'number' && typeof lat === 'number') {
          return [lat, lon];
        }
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
