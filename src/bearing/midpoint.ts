import type { LatLon } from '../types';

/**
 * Calculate the midpoint between two points
 * Returns the geographic midpoint along a great circle
 *
 * @param point1 - First point [lat, lon]
 * @returns Curried function that takes second point and returns midpoint
 *
 * @example
 * ```typescript
 * const fromNYC = midpoint([40.7128, -74.0060]);
 * const middle = fromNYC([34.0522, -118.2437]); // Midpoint between NYC and LA
 * ```
 */
export function midpoint(point1: LatLon) {
  return (point2: LatLon): LatLon => {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;

    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const lon1Rad = (lon1 * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const Bx = Math.cos(lat2Rad) * Math.cos(dLon);
    const By = Math.cos(lat2Rad) * Math.sin(dLon);

    const lat3Rad = Math.atan2(
      Math.sin(lat1Rad) + Math.sin(lat2Rad),
      Math.sqrt((Math.cos(lat1Rad) + Bx) * (Math.cos(lat1Rad) + Bx) + By * By)
    );

    const lon3Rad = lon1Rad + Math.atan2(By, Math.cos(lat1Rad) + Bx);

    const lat3 = (lat3Rad * 180) / Math.PI;
    const lon3 = (lon3Rad * 180) / Math.PI;

    return [lat3, lon3];
  };
}
