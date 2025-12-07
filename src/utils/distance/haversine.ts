import type { LatLon } from '../types';
import {
  EARTH_RADIUS_METERS,
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  DEGREES_TO_RADIANS,
} from '../constants';

/**
 * Curried Haversine distance function
 * Returns a function that calculates distance between two points using the Haversine formula
 *
 * @param radius - Earth's radius in the desired unit (meters, miles, km)
 * @returns A curried function that takes two points and returns distance
 *
 * @example
 * ```typescript
 * const haversineM = haversine(6371000); // meters
 * const distance = haversineM([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function haversine(radius: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): number => {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      const dLat = (lat2 - lat1) * DEGREES_TO_RADIANS;
      const dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * DEGREES_TO_RADIANS) *
          Math.cos(lat2 * DEGREES_TO_RADIANS) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return radius * c;
    };
  };
}

/**
 * Haversine distance in meters
 * Pre-configured for calculating distances in meters
 *
 * @example
 * ```typescript
 * const distance = haversineMeters([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const haversineMeters = haversine(EARTH_RADIUS_METERS);

/**
 * Haversine distance in kilometers
 * Pre-configured for calculating distances in kilometers
 *
 * @example
 * ```typescript
 * const distance = haversineKm([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const haversineKm = haversine(EARTH_RADIUS_KM);

/**
 * Haversine distance in miles
 * Pre-configured for calculating distances in miles
 *
 * @example
 * ```typescript
 * const distance = haversineMiles([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export const haversineMiles = haversine(EARTH_RADIUS_MILES);
