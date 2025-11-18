/**
 * Calculate intersection between line segments
 */

import type { LatLon } from '../types';

export type LineSegment = [LatLon, LatLon];

/**
 * Calculate the intersection point of two line segments
 * Uses parametric line equations to find intersection
 *
 * @param line1 - First line segment as [start, end]
 * @param line2 - Second line segment as [start, end]
 * @returns Intersection point as [lat, lon] or null if no intersection
 *
 * @example
 * const line1: LineSegment = [[40.7, -74.0], [40.71, -73.99]];
 * const line2: LineSegment = [[40.7, -73.99], [40.71, -74.0]];
 * const intersection = lineIntersection(line1, line2);
 * // Returns the intersection point or null
 */
export function lineIntersection(line1: LineSegment, line2: LineSegment): LatLon | null {
  const [[x1, y1], [x2, y2]] = line1;
  const [[x3, y3], [x4, y4]] = line2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel or coincident
  if (Math.abs(denom) < 1e-10) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const x = x1 + t * (x2 - x1);
    const y = y1 + t * (y2 - y1);
    return [x, y];
  }

  return null;
}

/**
 * Check if two line segments intersect (without calculating the point)
 *
 * @param line1 - First line segment as [start, end]
 * @param line2 - Second line segment as [start, end]
 * @returns true if lines intersect, false otherwise
 *
 * @example
 * const line1: LineSegment = [[40.7, -74.0], [40.71, -73.99]];
 * const line2: LineSegment = [[40.7, -73.99], [40.71, -74.0]];
 * const intersects = linesIntersect(line1, line2);
 * // Returns true or false
 */
export function linesIntersect(line1: LineSegment, line2: LineSegment): boolean {
  return lineIntersection(line1, line2) !== null;
}
