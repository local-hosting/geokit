import turfBboxPolygon from '@turf/bbox-polygon';
import turfCenter from '@turf/center';
import { points as turfPoints, featureCollection } from '@turf/helpers';
import type { LatLon, Bounds, Feature, FeatureCollection } from '../types';
import { extractLatLon } from '../turf-utils';

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

    const result = extractLatLon(center);
    return result;
  } catch {
    return null;
  }
}
