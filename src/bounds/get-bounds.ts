import turfBbox from '@turf/bbox';
import { points as turfPoints, featureCollection } from '@turf/helpers';
import type { LatLon, Bounds, Feature, FeatureCollection, Geometry } from '../types';
import { toLonLatArray } from '../turf-utils';

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
      // Filter and validate coordinates
      const validCoords = (input as LatLon[]).filter(
        (coord) =>
          Array.isArray(coord) &&
          coord.length === 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number' &&
          !isNaN(coord[0]) &&
          !isNaN(coord[1])
      ) as LatLon[];

      if (validCoords.length === 0) {
        return null;
      }

      // Convert [lat, lon] to [lon, lat] for Turf
      const coords = toLonLatArray(validCoords);
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
