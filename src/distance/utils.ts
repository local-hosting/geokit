import type { LatLon } from '../types';

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
