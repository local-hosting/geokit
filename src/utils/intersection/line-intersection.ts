/**
 * Calculate intersection between line segments using Turf.js
 */

import lineIntersectTurf from '@turf/line-intersect';
import { lineString } from '@turf/helpers';
import type { LatLon } from '../types';

export type LineSegment = [LatLon, LatLon];

/**
 * Calculate the intersection point of two line segments
 * Uses Turf.js for robust line intersection
 * Curried function for functional composition
 *
 * @param line1 - First line segment as [start, end]
 * @returns Function that takes second line segment and returns intersection point
 *
 * @example
 * const line1: LineSegment = [[40.7, -74.0], [40.71, -73.99]];
 * const line2: LineSegment = [[40.7, -73.99], [40.71, -74.0]];
 * const intersection = lineIntersection(line1)(line2);
 * // Returns the intersection point or null
 */
export function lineIntersection(line1: LineSegment) {
  return (line2: LineSegment): LatLon | null => {
    try {
      // Convert from [lat, lon] to [lon, lat] for Turf
      const [[lat1, lon1], [lat2, lon2]] = line1;
      const [[lat3, lon3], [lat4, lon4]] = line2;

      const turfLine1 = lineString([
        [lon1, lat1],
        [lon2, lat2],
      ]);
      const turfLine2 = lineString([
        [lon3, lat3],
        [lon4, lat4],
      ]);

      const intersections = lineIntersectTurf(turfLine1, turfLine2);

      if (intersections.features.length > 0) {
        const firstFeature = intersections.features[0];
        // Type-safe extraction with validation
        if (
          firstFeature.geometry.type === 'Point' &&
          Array.isArray(firstFeature.geometry.coordinates) &&
          firstFeature.geometry.coordinates.length >= 2
        ) {
          const [lon, lat] = firstFeature.geometry.coordinates;
          if (typeof lon === 'number' && typeof lat === 'number') {
            return [lat, lon];
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  };
}

/**
 * Check if two line segments intersect (without calculating the point)
 * Curried function for functional composition
 *
 * @param line1 - First line segment as [start, end]
 * @returns Function that takes second line segment and returns true if they intersect
 *
 * @example
 * const line1: LineSegment = [[40.7, -74.0], [40.71, -73.99]];
 * const line2: LineSegment = [[40.7, -73.99], [40.71, -74.0]];
 * const intersects = linesIntersect(line1)(line2);
 * // Returns true or false
 */
export function linesIntersect(line1: LineSegment) {
  return (line2: LineSegment): boolean => {
    return lineIntersection(line1)(line2) !== null;
  };
}
