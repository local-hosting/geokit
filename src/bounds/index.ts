import type { LatLon, Bounds, Feature, FeatureCollection, Geometry, LonLat } from '../types';
import { getCoordinates } from '../geojson';

/**
 * Calculate bounding box from coordinates or features
 *
 * @param input - Array of coordinates, features, or a feature collection
 * @returns Bounding box as [minLon, minLat, maxLon, maxLat], or null if no valid coordinates
 *
 * @example
 * ```typescript
 * const coords = [[40.7128, -74.0060], [40.7580, -73.9855]];
 * const bounds = getBounds(coords); // [-74.0060, 40.7128, -73.9855, 40.7580]
 * ```
 */
export function getBounds(
  input: LatLon[] | Feature[] | FeatureCollection | Geometry[]
): Bounds | null {
  const coordinates: LonLat[] = [];

  // Handle FeatureCollection
  if ('type' in input && input.type === 'FeatureCollection') {
    const collection = input as FeatureCollection;
    for (const feature of collection.features) {
      const coords = getCoordinates(feature);
      if (coords) {
        coordinates.push(coords);
      }
    }
  }
  // Handle array of Features
  else if (
    Array.isArray(input) &&
    input.length > 0 &&
    'type' in input[0] &&
    input[0].type === 'Feature'
  ) {
    for (const feature of input as Feature[]) {
      const coords = getCoordinates(feature);
      if (coords) {
        coordinates.push(coords);
      }
    }
  }
  // Handle array of Geometries
  else if (Array.isArray(input) && input.length > 0 && 'type' in input[0]) {
    for (const geometry of input as Geometry[]) {
      const coords = getCoordinates(geometry);
      if (coords) {
        coordinates.push(coords);
      }
    }
  }
  // Handle array of coordinates (assume [lat, lon] format)
  else if (Array.isArray(input) && input.length > 0) {
    for (const coord of input) {
      if (Array.isArray(coord) && coord.length === 2) {
        // Assume [lat, lon] and convert to [lon, lat]
        const [lat, lon] = coord as LatLon;
        if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
          coordinates.push([lon, lat]);
        }
      }
    }
  }

  if (coordinates.length === 0) {
    return null;
  }

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coordinates) {
    if (typeof lon === 'number' && typeof lat === 'number' && !isNaN(lon) && !isNaN(lat)) {
      minLon = Math.min(minLon, lon);
      minLat = Math.min(minLat, lat);
      maxLon = Math.max(maxLon, lon);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (minLon === Infinity || minLat === Infinity || maxLon === -Infinity || maxLat === -Infinity) {
    return null;
  }

  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Calculate center point from bounds or features
 *
 * @param input - Bounding box or array of coordinates/features
 * @returns Center point as [latitude, longitude], or null if invalid
 *
 * @example
 * ```typescript
 * const bounds = [-74.0060, 40.7128, -73.9855, 40.7580];
 * const center = getCenter(bounds); // [40.7354, -73.99575]
 * ```
 */
export function getCenter(input: Bounds | LatLon[] | Feature[] | FeatureCollection): LatLon | null {
  let bounds: Bounds | null = null;

  // If input is already bounds
  if (Array.isArray(input) && input.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = input;
    if (
      typeof minLon === 'number' &&
      typeof minLat === 'number' &&
      typeof maxLon === 'number' &&
      typeof maxLat === 'number'
    ) {
      bounds = input as Bounds;
    }
  }

  // Otherwise calculate bounds from input
  if (!bounds) {
    bounds = getBounds(input as LatLon[] | Feature[] | FeatureCollection);
  }

  if (!bounds) {
    return null;
  }

  const [minLon, minLat, maxLon, maxLat] = bounds;
  const centerLon = (minLon + maxLon) / 2;
  const centerLat = (minLat + maxLat) / 2;

  return [centerLat, centerLon];
}

/**
 * Curried function to check if a point is within bounds
 *
 * @param point - Point to check as [latitude, longitude]
 * @param bounds - Bounding box as [minLon, minLat, maxLon, maxLat]
 * @returns true if point is within bounds
 *
 * @example
 * ```typescript
 * const bounds = [-74.0060, 40.7128, -73.9855, 40.7580];
 * const point = [40.7354, -73.99575];
 * const isWithin = isWithinBounds(point)(bounds); // true
 * ```
 */
export function isWithinBounds(point: LatLon) {
  return (bounds: Bounds): boolean => {
    const [lat, lon] = point;
    const [minLon, minLat, maxLon, maxLat] = bounds;

    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  };
}
