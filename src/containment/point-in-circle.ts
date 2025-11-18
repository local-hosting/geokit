import type { LatLon } from '../types';

/**
 * Check if a point is within a circle
 * Uses Haversine formula for distance calculation
 *
 * @param radius - Circle radius in meters
 * @returns Curried function that takes center point
 *
 * @example
 * ```typescript
 * const within1km = pointInCircle(1000); // 1km radius
 * const checkFromNYC = within1km([40.7128, -74.0060]);
 * const isInside = checkFromNYC([40.7130, -74.0062]); // true or false
 * ```
 */
export function pointInCircle(radius: number) {
  return (center: LatLon) => {
    return (point: LatLon): boolean => {
      const [lat1, lon1] = center;
      const [lat2, lon2] = point;

      // Haversine formula for distance
      const R = 6371000; // Earth's radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      return distance <= radius;
    };
  };
}

/**
 * Check if a point is within a circle (simple helper without currying)
 *
 * @param point - Point to test [lat, lon]
 * @param center - Circle center [lat, lon]
 * @param radius - Circle radius in meters
 * @returns true if point is inside circle
 */
export function isPointInCircle(point: LatLon, center: LatLon, radius: number): boolean {
  return pointInCircle(radius)(center)(point);
}
