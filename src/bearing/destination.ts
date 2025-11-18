import turfDestination from '@turf/destination';
import { point as turfPoint } from '@turf/helpers';
import type { LatLon } from '../types';

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
export function destination(distance: number, bearingDegrees: number, radius: number = 6371000) {
  return (point: LatLon): LatLon => {
    try {
      const [lat, lon] = point;

      // Convert to Turf format [lon, lat]
      const pt = turfPoint([lon, lat]);

      // Convert distance to kilometers for Turf (Turf uses km by default)
      const distanceKm = distance / 1000;
      const dest = turfDestination(pt, distanceKm, bearingDegrees, { units: 'kilometers' });

      // Type-safe extraction
      if (
        dest.geometry.type === 'Point' &&
        Array.isArray(dest.geometry.coordinates) &&
        dest.geometry.coordinates.length >= 2
      ) {
        const [destLon, destLat] = dest.geometry.coordinates;
        if (typeof destLon === 'number' && typeof destLat === 'number') {
          return [destLat, destLon];
        }
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: simple spherical calculation
    const [lat, lon] = point;
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const bearingRad = (bearingDegrees * Math.PI) / 180;
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

    const lat2 = (lat2Rad * 180) / Math.PI;
    const lon2 = (lon2Rad * 180) / Math.PI;
    const lon2Normalized = ((lon2 + 540) % 360) - 180;

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
  return destination(distance, bearingDegrees, 6371000);
}

/**
 * Calculate destination point given distance in kilometers and bearing
 *
 * @param distance - Distance in kilometers
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @returns Curried function that takes start point and returns destination
 */
export function destinationKm(distance: number, bearingDegrees: number) {
  return destination(distance, bearingDegrees, 6371);
}

/**
 * Calculate destination point given distance in miles and bearing
 *
 * @param distance - Distance in miles
 * @param bearingDegrees - Bearing in degrees (0-360)
 * @returns Curried function that takes start point and returns destination
 */
export function destinationMiles(distance: number, bearingDegrees: number) {
  return destination(distance, bearingDegrees, 3959);
}
