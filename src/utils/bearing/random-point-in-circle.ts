import type { LatLon } from '../../types';
import { destinationMeters } from './destination';

/**
 * Pick a uniformly distributed random point inside a circle.
 *
 * @param radiusMeters - Circle radius in meters
 * @returns Function that takes a center [lat, lon] and returns a random point inside the circle
 */
export function randomPointInCircle(radiusMeters: number) {
  return (center: LatLon): LatLon => {
    const bearing = Math.random() * 360;
    const distance = Math.sqrt(Math.random()) * radiusMeters;
    return destinationMeters(distance, bearing)(center);
  };
}

/**
 * Pick a uniformly distributed random point inside a circle (radius in kilometers).
 */
export function randomPointInCircleKm(radiusKm: number) {
  return randomPointInCircle(radiusKm * 1000);
}
