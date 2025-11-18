import type { LatLon, LonLat, CoordinateObject, Point } from '../types';
import { toLatLon } from './conversion';

/**
 * Extract coordinates from various input formats
 * Supports: [lat, lon], [lon, lat], {lat, lon}, {latitude, longitude}, GeoJSON Point
 *
 * @param input - Coordinate in various formats
 * @returns Coordinates in [latitude, longitude] format, or null if invalid
 *
 * @example
 * ```typescript
 * extractCoordinates([40.7128, -74.0060]); // [40.7128, -74.0060]
 * extractCoordinates({lat: 40.7128, lon: -74.0060}); // [40.7128, -74.0060]
 * extractCoordinates({latitude: 40.7128, longitude: -74.0060}); // [40.7128, -74.0060]
 * ```
 */
export function extractCoordinates(
  input:
    | LatLon
    | LonLat
    | CoordinateObject
    | Point
    | { latitude: number; longitude: number }
    | null
    | undefined
): LatLon | null {
  if (!input) {
    return null;
  }

  // Array format [lat, lon] or [lon, lat]
  if (Array.isArray(input)) {
    if (input.length !== 2) {
      return null;
    }
    const [first, second] = input;

    // If first value is outside valid latitude range (-90 to 90), it must be longitude
    // So convert from [lon, lat] to [lat, lon]
    if (Math.abs(first) > 90) {
      return [second, first] as LatLon;
    }

    // If second value is outside valid latitude range, first must be latitude
    // Already in [lat, lon] format
    if (Math.abs(second) > 90) {
      return [first, second] as LatLon;
    }

    // If both values are within latitude range, use a heuristic:
    // If first value has larger absolute value, it's more likely to be longitude
    // (as most populated areas are closer to the equator)
    if (Math.abs(first) > Math.abs(second)) {
      return [second, first] as LatLon;
    }

    // Otherwise assume it's already in [lat, lon] format
    return [first, second] as LatLon;
  }

  // Object format {lat, lon} or {latitude, longitude}
  if (typeof input === 'object') {
    // GeoJSON Point
    if ('type' in input && input.type === 'Point' && 'coordinates' in input) {
      const point = input as Point;
      return toLatLon(point.coordinates);
    }

    // {lat, lon} format
    if ('lat' in input && 'lon' in input) {
      const obj = input as CoordinateObject;
      return [obj.lat, obj.lon];
    }

    // {latitude, longitude} format
    if ('latitude' in input && 'longitude' in input) {
      const obj = input as { latitude: number; longitude: number };
      return [obj.latitude, obj.longitude];
    }
  }

  return null;
}

/**
 * Normalize any coordinate input format to [lat, lon]
 * Alias for extractCoordinates with better naming for the use case
 *
 * @param input - Coordinate in any supported format
 * @returns Coordinates in [latitude, longitude] format, or null if invalid
 *
 * @example
 * ```typescript
 * normalizeCoordinateInput([40.7128, -74.0060]); // [40.7128, -74.0060]
 * normalizeCoordinateInput({latitude: 40.7128, longitude: -74.0060}); // [40.7128, -74.0060]
 * ```
 */
export function normalizeCoordinateInput(
  input:
    | LatLon
    | LonLat
    | CoordinateObject
    | { latitude: number; longitude: number }
    | Point
    | null
    | undefined
): LatLon | null {
  return extractCoordinates(input);
}
