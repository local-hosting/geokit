import type { LatLon } from '../types';

/**
 * Calculate destination point given start point, distance, and bearing
 * Uses spherical Earth model
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

    // Normalize longitude to -180 to 180
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
