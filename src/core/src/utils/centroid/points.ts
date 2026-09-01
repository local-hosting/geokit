/**
 * Calculate the centroid (geometric center) of a set of points
 */

import type { LatLon } from '../../types';

/**
 * Calculate the centroid of a set of points
 * Returns the average position of all points
 *
 * @param points - Array of points as [lat, lon]
 * @returns Centroid as [lat, lon] or null for empty array
 *
 * @example
 * const points = [
 *   [40.7128, -74.006],
 *   [40.758, -73.9855],
 *   [40.7354, -73.99575]
 * ];
 * const centroid = pointsCentroid(points);
 * // [40.73546667, -73.99575]
 */
export function pointsCentroid(points: LatLon[]): LatLon | null {
  if (!points || points.length === 0) {
    return null;
  }

  if (points.length === 1) {
    return points[0];
  }

  let totalLat = 0;
  let totalLon = 0;

  for (const [lat, lon] of points) {
    totalLat += lat;
    totalLon += lon;
  }

  return [totalLat / points.length, totalLon / points.length];
}
