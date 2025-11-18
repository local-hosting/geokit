import type { LatLon } from '../types';

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

      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return radius * c;
    };
  };
}

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Earth's radius in kilometers
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Earth's radius in miles
 */
const EARTH_RADIUS_MILES = 3959;

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

/**
 * Curried function to check if two points are within a specified distance
 *
 * @param threshold - Maximum distance threshold in the same unit as the distance function
 * @param distanceFn - Distance function (e.g., haversineMeters)
 * @returns A curried function that takes two points and returns true if within threshold
 *
 * @example
 * ```typescript
 * const within100m = withinDistance(100, haversineMeters);
 * const isClose = within100m([40.7128, -74.0060])([40.7130, -74.0062]);
 * ```
 */
export function withinDistance(
  threshold: number,
  distanceFn: (point1: LatLon) => (point2: LatLon) => number
) {
  return (point1: LatLon) => {
    return (point2: LatLon): boolean => {
      return distanceFn(point1)(point2) <= threshold;
    };
  };
}
