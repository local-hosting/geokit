import type { LatLon } from '../../types';
import {
  EARTH_RADIUS_METERS,
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  DEGREES_TO_RADIANS,
  TWO_PI,
} from '../../constants';

/**
 * Rhumb line (loxodrome) distance
 * Calculates distance along a constant bearing
 * Useful for navigation and constant-course calculations
 *
 * @param radius - Earth's radius in the desired unit (meters, miles, km)
 * @returns A curried function that takes two points and returns distance
 *
 * @example
 * ```typescript
 * const rhumbM = rhumbLine(6371000); // meters
 * const distance = rhumbM([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function rhumbLine(radius: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): number => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      const lat1Rad = lat1 * DEGREES_TO_RADIANS;
      const lat2Rad = lat2 * DEGREES_TO_RADIANS;
      const dLat = lat2Rad - lat1Rad;
      let dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

      // Ensure dLon takes the shortest path
      if (Math.abs(dLon) > Math.PI) {
        dLon = dLon > 0 ? -(TWO_PI - dLon) : TWO_PI + dLon;
      }

      // E-W course becomes ill-conditioned with 0/0
      const dPhi = Math.log(
        Math.tan(lat2Rad / 2 + Math.PI / 4) / Math.tan(lat1Rad / 2 + Math.PI / 4)
      );
      const q = Math.abs(dPhi) > 10e-12 ? dLat / dPhi : Math.cos(lat1Rad);

      const distance = Math.sqrt(dLat * dLat + q * q * dLon * dLon) * radius;

      return distance;
    };
  };
}

/**
 * Rhumb line distance in meters
 * Pre-configured for calculating distances in meters
 *
 * @example
 * ```typescript
 * const distance = rhumbLineMeters([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const rhumbLineMeters = rhumbLine(EARTH_RADIUS_METERS);

/**
 * Rhumb line distance in kilometers
 * Pre-configured for calculating distances in kilometers
 *
 * @example
 * ```typescript
 * const distance = rhumbLineKm([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const rhumbLineKm = rhumbLine(EARTH_RADIUS_KM);

/**
 * Rhumb line distance in miles
 * Pre-configured for calculating distances in miles
 *
 * @example
 * ```typescript
 * const distance = rhumbLineMiles([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const rhumbLineMiles = rhumbLine(EARTH_RADIUS_MILES);
