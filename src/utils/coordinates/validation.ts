import type { Coordinate } from '../types';
import { MIN_LATITUDE, MAX_LATITUDE, MIN_LONGITUDE, MAX_LONGITUDE } from '../constants';

/**
 * Validate that coordinates are valid numbers within valid ranges
 *
 * @param coords - Coordinate pair to validate
 * @returns true if coordinates are valid
 *
 * @example
 * ```typescript
 * isValidCoordinate([40.7128, -74.0060]); // true
 * isValidCoordinate([91, -74.0060]); // false (latitude out of range)
 * ```
 */
export function isValidCoordinate(coords: Coordinate): boolean {
  if (!Array.isArray(coords) || coords.length !== 2) {
    return false;
  }

  const [lat, lon] = coords;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return false;
  }

  if (isNaN(lat) || isNaN(lon)) {
    return false;
  }

  // Latitude must be between -90 and 90
  if (lat < MIN_LATITUDE || lat > MAX_LATITUDE) {
    return false;
  }

  // Longitude must be between -180 and 180
  if (lon < MIN_LONGITUDE || lon > MAX_LONGITUDE) {
    return false;
  }

  return true;
}
