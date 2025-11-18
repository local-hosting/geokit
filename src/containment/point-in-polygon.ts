import type { LatLon, Polygon } from '../types';

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * Works with any polygon (convex or concave)
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
    const [lat, lon] = point;

    // Get the outer ring (first array of coordinates)
    const ring = polygon.coordinates[0];
    if (!ring || ring.length < 4) {
      return false; // Invalid polygon
    }

    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; // [lon, lat] in GeoJSON format
      const [xj, yj] = ring[j];

      // Ray casting algorithm - check if ray from point crosses edge
      const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
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
