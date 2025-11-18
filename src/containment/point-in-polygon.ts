import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint, polygon as turfPolygon } from '@turf/helpers';
import type { LatLon, Polygon } from '../types';

/**
 * Check if a point is inside a polygon
 * Uses Turf.js for robust point-in-polygon testing (properly handles holes)
 *
 * @param point - Point to test [lat, lon]
 * @returns Curried function that takes polygon and returns true if point is inside
 *
 * @example
 * ```typescript
 * const testPoint = pointInPolygon([40.7128, -74.0060]);
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]]
 * };
 * const isInside = testPoint(polygon); // true or false
 * ```
 */
export function pointInPolygon(point: LatLon) {
  return (polygon: Polygon): boolean => {
    // Get the outer ring (first array of coordinates)
    const ring = polygon.coordinates[0];
    if (!ring || ring.length < 4) {
      return false; // Invalid polygon
    }

    try {
      // Convert [lat, lon] to [lon, lat] for Turf
      const [lat, lon] = point;
      const pt = turfPoint([lon, lat]);
      const poly = turfPolygon(polygon.coordinates);

      return booleanPointInPolygon(pt, poly);
    } catch {
      return false;
    }
  };
}

/**
 * Check if a point is inside a polygon (simple helper without currying)
 *
 * @param point - Point to test [lat, lon]
 * @param polygon - Polygon geometry
 * @returns true if point is inside polygon
 */
export function isPointInPolygon(point: LatLon, polygon: Polygon): boolean {
  return pointInPolygon(point)(polygon);
}
