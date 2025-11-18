import turfBbox from '@turf/bbox';
import turfBboxPolygon from '@turf/bbox-polygon';
import turfCenter from '@turf/center';
import { points as turfPoints, featureCollection } from '@turf/helpers';
import type { LatLon, Bounds, Feature, FeatureCollection, Geometry } from '../types';

/**
 * Calculate bounding box from coordinates or features
 * Uses Turf.js for robust bbox calculation
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
  try {
    let turfFeature: Feature | FeatureCollection | null = null;

    // Handle FeatureCollection
    if ('type' in input && input.type === 'FeatureCollection') {
      turfFeature = input as FeatureCollection;
    }
    // Handle array of Features
    else if (
      Array.isArray(input) &&
      input.length > 0 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      'type' in input[0] &&
      input[0].type === 'Feature'
    ) {
      turfFeature = featureCollection(input as Feature[]);
    }
    // Handle array of Geometries
    else if (
      Array.isArray(input) &&
      input.length > 0 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      'type' in input[0]
    ) {
      // Convert geometries to features
      const features = (input as Geometry[]).map((geom) => ({
        type: 'Feature' as const,
        geometry: geom,
        properties: {},
      }));
      turfFeature = featureCollection(features);
    }
    // Handle array of coordinates (assume [lat, lon] format)
    else if (Array.isArray(input) && input.length > 0) {
      // Convert [lat, lon] to [lon, lat] for Turf
      const coords = (input as LatLon[])
        .filter((coord) => Array.isArray(coord) && coord.length === 2)
        .map(([lat, lon]) => {
          if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
            return [lon, lat];
          }
          return null;
        })
        .filter((coord): coord is [number, number] => coord !== null);

      if (coords.length === 0) {
        return null;
      }

      turfFeature = turfPoints(coords);
    }

    if (!turfFeature) {
      return null;
    }

    const bbox = turfBbox(turfFeature);

    // Validate bbox (should be [minLon, minLat, maxLon, maxLat])
    if (
      Array.isArray(bbox) &&
      bbox.length === 4 &&
      typeof bbox[0] === 'number' &&
      typeof bbox[1] === 'number' &&
      typeof bbox[2] === 'number' &&
      typeof bbox[3] === 'number'
    ) {
      return bbox as Bounds;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Calculate center point from bounds or features
 * Uses Turf.js for robust center calculation
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
  try {
    let turfFeature: Feature | FeatureCollection | null = null;

    // If input is already bounds, convert to polygon
    if (Array.isArray(input) && input.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = input;
      if (
        typeof minLon === 'number' &&
        typeof minLat === 'number' &&
        typeof maxLon === 'number' &&
        typeof maxLat === 'number'
      ) {
        // Create a polygon from bounds using Turf
        const bboxPoly = turfBboxPolygon([minLon, minLat, maxLon, maxLat]);
        turfFeature = bboxPoly;
      }
    }
    // Handle FeatureCollection
    else if ('type' in input && input.type === 'FeatureCollection') {
      turfFeature = input as FeatureCollection;
    }
    // Handle array of Features
    else if (
      Array.isArray(input) &&
      input.length > 0 &&
      typeof input[0] === 'object' &&
      input[0] !== null &&
      'type' in input[0] &&
      input[0].type === 'Feature'
    ) {
      turfFeature = featureCollection(input as Feature[]);
    }
    // Handle array of coordinates
    else if (Array.isArray(input) && input.length > 0) {
      // Convert [lat, lon] to [lon, lat] for Turf
      const coords = (input as LatLon[])
        .filter((coord) => Array.isArray(coord) && coord.length === 2)
        .map(([lat, lon]) => {
          if (typeof lat === 'number' && typeof lon === 'number' && !isNaN(lat) && !isNaN(lon)) {
            return [lon, lat];
          }
          return null;
        })
        .filter((coord): coord is [number, number] => coord !== null);

      if (coords.length === 0) {
        return null;
      }

      turfFeature = turfPoints(coords);
    }

    if (!turfFeature) {
      return null;
    }

    const center = turfCenter(turfFeature);

    // Type-safe extraction
    if (
      center.geometry.type === 'Point' &&
      Array.isArray(center.geometry.coordinates) &&
      center.geometry.coordinates.length >= 2
    ) {
      const [lon, lat] = center.geometry.coordinates;
      if (typeof lon === 'number' && typeof lat === 'number') {
        return [lat, lon];
      }
    }

    return null;
  } catch {
    return null;
  }
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
