

import type { LatLon, Polygon } from '../../types';
import { createPointFeature, validatePolygon } from '../turf-utils';
import { booleanPointInPolygon, turfPolygon } from '../turf/deps';

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
    if (!validatePolygon(polygon)) {
      return false;
    }

    try {
      const pt = createPointFeature(point);
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
