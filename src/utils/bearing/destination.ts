import turfDestination from '@turf/destination';
import type { LatLon } from '../types';
import {
  EARTH_RADIUS_METERS,
  EARTH_RADIUS_KM,
  EARTH_RADIUS_MILES,
  METERS_TO_KILOMETERS,
  DEGREES_TO_RADIANS,
  RADIANS_TO_DEGREES,
  LONGITUDE_NORMALIZATION_OFFSET,
  DEGREES_IN_CIRCLE,
} from '../constants';
import { createPointFeature, extractLatLon } from '../turf-utils';

/**
 * Calculate destination point given start point, distance, and bearing
 * Uses Turf.js for robust destination calculation
 *
 * @param distance - Distance in the same unit as Earth's radius
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @param radius - Earth's radius in desired unit (default: meters)
 * @returns Curried function that takes start point and returns destination
 *
 * @example
 * ```typescript
 * const destination50km = destination(50000, 90, 6371000); // 50km east
 * const dest = destination50km([40.7128, -74.0060]);
 * ```
 */
export function destination(
  distance: number,
  bearingDegrees: number,
  radius: number = EARTH_RADIUS_METERS
) {
  return (point: LatLon): LatLon => {
    try {
      const pt = createPointFeature(point);

      // Convert distance to kilometers for Turf (Turf uses km by default)
      const distanceKm = distance / METERS_TO_KILOMETERS;
      const dest = turfDestination(pt, distanceKm, bearingDegrees, { units: 'kilometers' });

      const result = extractLatLon(dest);
      if (result) {
        return result;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: simple spherical calculation
    const [lat, lon] = point;
    const latRad = lat * DEGREES_TO_RADIANS;
    const lonRad = lon * DEGREES_TO_RADIANS;
    const bearingRad = bearingDegrees * DEGREES_TO_RADIANS;
    const angularDistance = distance / radius;

    const lat2Rad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    const lon2Rad =
      lonRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2Rad)
      );

    const lat2 = lat2Rad * RADIANS_TO_DEGREES;
    const lon2 = lon2Rad * RADIANS_TO_DEGREES;
    const lon2Normalized = ((lon2 + LONGITUDE_NORMALIZATION_OFFSET) % DEGREES_IN_CIRCLE) - 180;

    return [lat2, lon2Normalized];
  };
}

/**
 * Calculate destination point given distance in meters and bearing
 * Pre-configured for distances in meters
 *
 * @param distance - Distance in meters
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @returns Curried function that takes start point and returns destination
 *
 * @example
 * ```typescript
 * const move1km = destinationMeters(1000, 90); // 1km east
 * const newLocation = move1km([40.7128, -74.0060]);
 * ```
 */
export function destinationMeters(distance: number, bearingDegrees: number) {
  return destination(distance, bearingDegrees, EARTH_RADIUS_METERS);
}

/**
 * Calculate destination point given distance in kilometers and bearing
 *
 * @param distance - Distance in kilometers
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @returns Curried function that takes start point and returns destination
 */
export function destinationKm(distance: number, bearingDegrees: number) {
  return destination(distance, bearingDegrees, EARTH_RADIUS_KM);
}

/**
 * Calculate destination point given distance in miles and bearing
 *
 * @param distance - Distance in miles
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @returns Curried function that takes start point and returns destination
 */
export function destinationMiles(distance: number, bearingDegrees: number) {
  return destination(distance, bearingDegrees, EARTH_RADIUS_MILES);
}
