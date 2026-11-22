import type { LatLon, Polygon } from '../../types';
import { toLonLatArray } from '../coordinates/conversion';
import { monotoneChainConvexHullLonLat } from './convex-hull-monotone';

/**
 * Calculate the convex hull of a set of points
 * Uses a monotone-chain hull on [lon, lat] (no @turf/convex / concaveman — CJS under Vite).
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
    const ring = monotoneChainConvexHullLonLat(coords);
    if (!ring) return null;

    return { type: 'Polygon', coordinates: [ring] };
  } catch {
    return null;
  }
}
