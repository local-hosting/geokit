import type { LatLon } from '../types';
import { extractCoordinates } from './extraction';

/**
 * Serialize coordinates to JSON string
 *
 * @param coords - Coordinates in [latitude, longitude] format
 * @returns JSON string representation of coordinates
 *
 * @example
 * ```typescript
 * const json = serializeCoordinates([40.7128, -74.0060]);
 * // '{"lat":40.7128,"lon":-74.0060}'
 * ```
 */
export function serializeCoordinates(coords: LatLon): string {
  const [lat, lon] = coords;
  return JSON.stringify({ lat, lon });
}

/**
 * Deserialize coordinates from JSON string
 *
 * @param json - JSON string representation of coordinates
 * @returns Coordinates in [latitude, longitude] format, or null if invalid
 *
 * @example
 * ```typescript
 * const coords = deserializeCoordinates('{"lat":40.7128,"lon":-74.0060}');
 * // [40.7128, -74.0060]
 * ```
 */
export function deserializeCoordinates(json: string): LatLon | null {
  try {
    const parsed = JSON.parse(json);

    // Try {lat, lon} format
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'lat' in parsed &&
      'lon' in parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number'
    ) {
      return [parsed.lat, parsed.lon];
    }

    // Try {latitude, longitude} format
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'latitude' in parsed &&
      'longitude' in parsed &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number'
    ) {
      return [parsed.latitude, parsed.longitude];
    }

    // Try array format [lat, lon] or [lon, lat]
    if (Array.isArray(parsed) && parsed.length === 2) {
      return extractCoordinates(parsed as [number, number]);
    }

    return null;
  } catch {
    return null;
  }
}
