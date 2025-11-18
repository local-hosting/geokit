/**
 * Calculate the convex hull of a set of points using Graham scan algorithm
 */

import type { LatLon } from '../types';

/**
 * Calculate cross product of three points
 * Positive if counter-clockwise, negative if clockwise, zero if collinear
 */
function cross(o: LatLon, a: LatLon, b: LatLon): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/**
 * Calculate the convex hull of a set of points
 * Uses the Graham scan algorithm
 *
 * @param points - Array of points as [lat, lon]
 * @returns Array of points forming the convex hull (counter-clockwise), or empty array if < 3 points
 *
 * @example
 * const points = [
 *   [40.7128, -74.006],
 *   [40.758, -73.9855],
 *   [40.7354, -73.99575],
 *   [40.73, -74.0],
 *   [40.74, -73.98]
 * ];
 * const hull = convexHull(points);
 * // Returns points forming the convex boundary
 */
export function convexHull(points: LatLon[]): LatLon[] {
  if (!points || points.length < 3) {
    return [];
  }

  // Remove duplicates
  const uniquePoints: LatLon[] = [];
  const seen = new Set<string>();

  for (const point of points) {
    const key = `${point[0]},${point[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(point);
    }
  }

  if (uniquePoints.length < 3) {
    return [];
  }

  // Sort points lexicographically (first by lat, then by lon)
  const sorted = uniquePoints.slice().sort((a, b) => {
    if (a[0] !== b[0]) {
      return a[0] - b[0];
    }
    return a[1] - b[1];
  });

  // Build lower hull
  const lower: LatLon[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  }

  // Build upper hull
  const upper: LatLon[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  }

  // Remove last point of each half because it's repeated at the beginning of the other half
  lower.pop();
  upper.pop();

  // Concatenate lower and upper hull
  const hull = lower.concat(upper);

  // Close the polygon by adding the first point at the end
  if (hull.length > 0) {
    hull.push(hull[0]);
  }

  return hull;
}
