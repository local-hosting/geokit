import type { LatLon } from '../types';
import { haversineMeters } from './haversine';

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

/**
 * Simple non-curried distance function for easier use in scripts
 * Calculates distance between two points in meters using Haversine formula
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in meters
 *
 * @example
 * ```typescript
 * const dist = distance(40.7128, -74.0060, 40.7580, -73.9855);
 * ```
 */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineMeters([lat1, lon1])([lat2, lon2]);
}
