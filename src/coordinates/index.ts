import type { LatLon, LonLat, Coordinate, CoordinateObject, Point } from '../types';

/**
 * Convert GeoJSON format [lon, lat] to [lat, lon]
 *
 * @param coords - Coordinates in GeoJSON format [longitude, latitude]
 * @returns Coordinates in [latitude, longitude] format
 *
 * @example
 * ```typescript
 * const latLon = toLatLon([-74.0060, 40.7128]); // [40.7128, -74.0060]
 * ```
 */
export function toLatLon(coords: LonLat): LatLon {
  return [coords[1], coords[0]];
}

/**
 * Convert [lat, lon] to GeoJSON format [lon, lat]
 *
 * @param coords - Coordinates in [latitude, longitude] format
 * @returns Coordinates in GeoJSON format [longitude, latitude]
 *
 * @example
 * ```typescript
 * const lonLat = toLonLat([40.7128, -74.0060]); // [-74.0060, 40.7128]
 * ```
 */
export function toLonLat(coords: LatLon): LonLat {
  return [coords[1], coords[0]];
}

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
  if (lat < -90 || lat > 90) {
    return false;
  }

  // Longitude must be between -180 and 180
  if (lon < -180 || lon > 180) {
    return false;
  }

  return true;
}

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
 * Create a GeoJSON Point from coordinates
 *
 * @param coords - Coordinates in [latitude, longitude] format
 * @returns GeoJSON Point geometry
 *
 * @example
 * ```typescript
 * const point = createPoint([40.7128, -74.0060]);
 * // { type: 'Point', coordinates: [-74.0060, 40.7128] }
 * ```
 */
export function createPoint(coords: LatLon): Point {
  return {
    type: 'Point',
    coordinates: toLonLat(coords),
  };
}
