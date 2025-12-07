/**
 * Calculate the convex hull of a set of points using Turf.js
 */

import convexTurf from '@turf/convex';
import { points as turfPoints } from '@turf/helpers';
import type { LatLon, Polygon } from '../types';
import { toLonLatArray } from '../coordinates/conversion';

/**
 * Calculate the convex hull of a set of points
 * Uses Turf.js for robust convex hull calculation
 * Returns a GeoJSON Polygon in [lon, lat] format
 *
 * @param points - Array of points as [lat, lon]
 * @returns GeoJSON Polygon representing the convex hull, or null if < 3 points or calculation fails
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
 * // Returns { type: 'Polygon', coordinates: [[[lon, lat], ...]] }
 */
export function convexHull(points: LatLon[]): Polygon | null {
  if (!points || points.length < 3) {
    return null;
  }

  try {
    // Convert from [lat, lon] to [lon, lat] for Turf
    const coords = toLonLatArray(points);
    const collection = turfPoints(coords);

    const hull = convexTurf(collection);

    if (!hull || hull.geometry.type !== 'Polygon') {
      return null;
    }

    // Return GeoJSON Polygon directly (already in [lon, lat] format)
    return hull.geometry;
  } catch {
    return null;
  }
}
