/**
 * Calculate the centroid (geometric center) of a polygon
 * Uses Turf.js for robust centroid calculation
 */

import turfCentroid from '@turf/centroid';
import { polygon as turfPolygon } from '@turf/helpers';
import type { Polygon, LatLon } from '../../types';
import { validatePolygon, extractLatLon } from '../turf-utils';

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
  if (!validatePolygon(polygon)) {
    return null;
  }

  try {
    // Turf expects GeoJSON format which already uses [lon, lat]
    const turfPoly = turfPolygon(polygon.coordinates);
    const centroid = turfCentroid(turfPoly);

    const result = extractLatLon(centroid);
    if (result) {
      return result;
    }
  } catch {
    // Silently fall through to fallback
  }

  // Fallback: return center of bounding box
  const ring = polygon.coordinates[0];
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([_, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}
