import type { LatLon, LonLat, CoordinateObject, Point } from '../../types';
import { toLatLon } from './conversion';

/**
 * Detect and convert coordinate array format from [lat, lon] or [lon, lat] to [lat, lon]
 * Uses heuristics to auto-detect the format when both values are within valid latitude range
 *
 * @param coord - Coordinate pair as [first, second]
 * @returns Coordinates in [latitude, longitude] format
 *
 * @internal
 */
export function detectAndConvertCoordinateFormat(coord: [number, number]): LatLon {
  const [first, second] = coord;

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

  // Special case: if first value is exactly 90 or -90, it's definitely latitude
  if (Math.abs(first) === 90) {
    return [first, second] as LatLon;
  }

  // If both values are within latitude range, use a heuristic:
  // If first value has larger absolute value AND it's not a pole, it's more likely to be longitude
  // (as most populated areas are closer to the equator)
  if (Math.abs(first) > Math.abs(second) && Math.abs(first) < 90) {
    return [second, first] as LatLon;
  }

  // Otherwise assume it's already in [lat, lon] format
  return [first, second] as LatLon;
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
    return detectAndConvertCoordinateFormat([input[0], input[1]]);
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
/** GeoJSON Point geometry → `{ lng, lat }` for map anchors and popups. */
export function extractPointLngLat(
  geometry: GeoJSON.Geometry | unknown
): { lng: number; lat: number } | null {
  if (
    geometry &&
    typeof geometry === 'object' &&
    'type' in geometry &&
    (geometry as GeoJSON.Geometry).type === 'Point' &&
    'coordinates' in geometry
  ) {
    const coords = (geometry as GeoJSON.Point).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (Number.isFinite(lng) && Number.isFinite(lat)) {
        return { lng, lat };
      }
    }
  }
  return null;
}

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

/**
 * Normalize an array of coordinates to a specific format
 * Handles batch conversion of coordinate arrays with format detection
 *
 * @param coordinates - Array of coordinate pairs in various formats
 * @param outputFormat - Desired output format: 'latlon' (default) or 'lonlat' (GeoJSON)
 * @param inputFormat - Input format hint: 'auto' (detect), 'latlng', or 'lnglat'
 * @returns Array of coordinates in the specified output format
 *
 * @example
 * ```typescript
 * // Auto-detect and convert to [lat, lon]
 * const coords = normalizeCoordinatesArray([[-74.0060, 40.7128], [-73.9855, 40.7580]]);
 * // [[40.7128, -74.0060], [40.7580, -73.9855]]
 *
 * // Convert to GeoJSON format [lon, lat]
 * const geoJson = normalizeCoordinatesArray([[40.7128, -74.0060]], 'lonlat', 'latlng');
 * // [[-74.0060, 40.7128]]
 * ```
 */
export function normalizeCoordinatesArray(
  coordinates: (LatLon | LonLat)[],
  outputFormat: 'latlon' | 'lonlat' = 'latlon',
  inputFormat: 'auto' | 'latlng' | 'lnglat' = 'auto'
): LatLon[] | LonLat[] {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return [];
  }

  // First, normalize all coordinates to [lat, lon] format
  const normalized: LatLon[] = coordinates
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        return null;
      }

      if (inputFormat === 'lnglat') {
        // Input is [lon, lat], convert to [lat, lon]
        const [lon, lat] = coord;
        return [lat, lon] as LatLon;
      } else if (inputFormat === 'latlng') {
        // Already in [lat, lon] format
        return coord as LatLon;
      } else {
        // Auto-detect: use shared detection logic
        return detectAndConvertCoordinateFormat([coord[0], coord[1]]);
      }
    })
    .filter((coord): coord is LatLon => coord !== null);

  // Convert to output format if needed
  if (outputFormat === 'lonlat') {
    return normalized.map(([lat, lon]) => [lon, lat] as LonLat);
  }

  return normalized;
}
