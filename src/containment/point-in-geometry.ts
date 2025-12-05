import type { LatLon, Polygon, MultiPolygon } from '../types';
import { isPointInPolygon } from './point-in-polygon';

/**
 * Check if a point is inside a geometry (Polygon or MultiPolygon)
 * Handles both Polygon and MultiPolygon types
 *
 * @param point - Point to test [lat, lon]
 * @param geometry - Polygon or MultiPolygon geometry
 * @returns true if point is inside geometry
 *
 * @example
 * ```typescript
 * const point = [40.7128, -74.0060];
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]]
 * };
 * const isInside = pointInGeometry(point, polygon); // true
 * ```
 */
export function pointInGeometry(point: LatLon, geometry: Polygon | MultiPolygon): boolean {
  if (!geometry || !geometry.coordinates) {
    return false;
  }

  if (geometry.type === 'Polygon') {
    return isPointInPolygon(point, geometry);
  } else if (geometry.type === 'MultiPolygon') {
    // Check if point is in any polygon of the MultiPolygon
    for (const polygonCoords of geometry.coordinates) {
      if (polygonCoords && polygonCoords[0]) {
        const polygon: Polygon = {
          type: 'Polygon',
          coordinates: polygonCoords,
        };
        if (isPointInPolygon(point, polygon)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a point is inside a geometry (curried version)
 * Returns a function that takes geometry and returns true if point is inside
 *
 * @param point - Point to test [lat, lon]
 * @returns Function that takes geometry and returns true if point is inside
 *
 * @example
 * ```typescript
 * const testPoint = pointInGeometryCurried([40.7128, -74.0060]);
 * const isInside = testPoint(polygon); // true or false
 * ```
 */
export function pointInGeometryCurried(point: LatLon) {
  return (geometry: Polygon | MultiPolygon): boolean => {
    return pointInGeometry(point, geometry);
  };
}
