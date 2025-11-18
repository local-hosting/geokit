/**
 * Calculate the centroid (geometric center) of a polygon
 * Uses the standard polygon centroid formula
 */

import type { Polygon, LatLon } from '../types';

/**
 * Calculate the centroid of a polygon
 * Returns the geometric center point of the polygon
 *
 * @param polygon - Polygon to calculate centroid for
 * @returns Centroid as [lat, lon] or null for invalid polygons
 *
 * @example
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [
 *     [
 *       [-74.01, 40.7],
 *       [-74.0, 40.7],
 *       [-74.0, 40.71],
 *       [-74.01, 40.71],
 *       [-74.01, 40.7]
 *     ]
 *   ]
 * };
 * const centroid = polygonCentroid(polygon);
 * // [40.705, -74.005]
 */
export function polygonCentroid(polygon: Polygon): LatLon | null {
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    return null;
  }

  // Use the outer ring (first ring)
  const ring = polygon.coordinates[0];

  if (!ring || ring.length < 4) {
    return null;
  }

  // Convert to [lon, lat] for calculation
  let area = 0;
  let x = 0;
  let y = 0;

  // Calculate using the standard centroid formula
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[i + 1];

    const f = lon1 * lat2 - lon2 * lat1;
    area += f;
    x += (lon1 + lon2) * f;
    y += (lat1 + lat2) * f;
  }

  area *= 0.5;

  if (area === 0) {
    // Degenerate polygon, return center of bounding box
    const lons = ring.map(([lon]) => lon);
    const lats = ring.map(([_, lat]) => lat);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
  }

  x /= 6 * area;
  y /= 6 * area;

  // Return as [lat, lon]
  return [y, x];
}
