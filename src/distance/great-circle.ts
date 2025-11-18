import type { LatLon } from '../types';
import {
  EARTH_RADIUS_METERS,
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  DEGREES_TO_RADIANS,
} from '../constants';

/**
 * Great Circle distance using spherical law of cosines
 * Simple and fast, suitable for most applications
 *
 * @param radius - Earth's radius in the desired unit (meters, miles, km)
 * @returns A curried function that takes two points and returns distance
 *
 * @example
 * ```typescript
 * const gcM = greatCircle(6371000); // meters
 * const distance = gcM([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function greatCircle(radius: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): number => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      const lat1Rad = lat1 * DEGREES_TO_RADIANS;
      const lat2Rad = lat2 * DEGREES_TO_RADIANS;
      const dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

      const distance =
        Math.acos(
          Math.sin(lat1Rad) * Math.sin(lat2Rad) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon)
        ) * radius;

      return distance;
    };
  };
}

/**
 * Great Circle distance in meters
 * Pre-configured for calculating distances in meters
 *
 * @example
 * ```typescript
 * const distance = greatCircleMeters([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const greatCircleMeters = greatCircle(EARTH_RADIUS_METERS);

/**
 * Great Circle distance in kilometers
 * Pre-configured for calculating distances in kilometers
 *
 * @example
 * ```typescript
 * const distance = greatCircleKm([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const greatCircleKm = greatCircle(EARTH_RADIUS_KM);

/**
 * Great Circle distance in miles
 * Pre-configured for calculating distances in miles
 *
 * @example
 * ```typescript
 * const distance = greatCircleMiles([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const greatCircleMiles = greatCircle(EARTH_RADIUS_MILES);
