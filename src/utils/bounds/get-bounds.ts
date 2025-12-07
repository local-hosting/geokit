import turfBbox from '@turf/bbox';
import { points as turfPoints, featureCollection } from '@turf/helpers';
import type { LatLon, LonLat, Bounds, Feature, FeatureCollection, Geometry } from '../types';

/**
 * Normalize coordinate arrays to LonLat format (GeoJSON) for Turf
 * Accepts both [lat, lon] and [lon, lat] formats
 * Uses same detection logic as extractCoordinates
 */
function normalizeToLonLat(coords: LatLon[] | LonLat[]): LonLat[] {
  if (!coords || coords.length === 0) {
    return [];
  }

  return coords
    .map((coord) => {
      if (!Array.isArray(coord) || coord.length < 2) {
        return null;
      }

      const [first, second] = coord;

      // If first value is outside valid latitude range (-90 to 90), it must be longitude
      // Already in [lon, lat] format
      if (Math.abs(first) > 90) {
        return [first, second] as LonLat;
      }

      // If second value is outside valid latitude range, first must be latitude
      // Convert from [lat, lon] to [lon, lat]
      if (Math.abs(second) > 90) {
        return [second, first] as LonLat;
      }

      // Special case: if first value is exactly 90 or -90, it's definitely latitude
      if (Math.abs(first) === 90) {
        return [second, first] as LonLat;
      }

      // If both values are within latitude range, use a heuristic:
      // If first value has larger absolute value AND it's not a pole, it's more likely to be longitude
      // (as most populated areas are closer to the equator)
      if (Math.abs(first) > Math.abs(second) && Math.abs(first) < 90) {
        return [first, second] as LonLat;
      }

      // Otherwise assume it's [lat, lon] and convert to [lon, lat]
      return [second, first] as LonLat;
    })
    .filter((coord): coord is LonLat => coord !== null);
}

/**
 * Calculate bounding box from coordinates or features
 * Uses Turf.js for robust bbox calculation
 * Accepts coordinates in both [lat, lon] and [lon, lat] (GeoJSON) formats
 *
 * @param input - Array of coordinates ([lat, lon] or [lon, lat]), features, geometries, or a feature collection
 * @returns Bounding box as [minLon, minLat, maxLon, maxLat], or null if no valid coordinates
 *
 * @example
 * ```typescript
 * // Using [lat, lon] format
 * const coords = [[40.7128, -74.0060], [40.7580, -73.9855]];
 * const bounds = getBounds(coords); // [-74.0060, 40.7128, -73.9855, 40.7580]
 *
 * // Using [lon, lat] GeoJSON format
 * const geoJsonCoords = [[-74.0060, 40.7128], [-73.9855, 40.7580]];
 * const bounds2 = getBounds(geoJsonCoords); // [-74.0060, 40.7128, -73.9855, 40.7580]
 * ```
 */
export function getBounds(
  input: LatLon[] | LonLat[] | Feature[] | FeatureCollection | Geometry[]
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
    // Handle array of coordinates (accepts both [lat, lon] and [lon, lat] formats)
    else if (Array.isArray(input) && input.length > 0) {
      // Filter and validate coordinates
      const validCoords = (input as LatLon[] | LonLat[]).filter(
        (coord) =>
          Array.isArray(coord) &&
          coord.length === 2 &&
          typeof coord[0] === 'number' &&
          typeof coord[1] === 'number' &&
          !isNaN(coord[0]) &&
          !isNaN(coord[1])
      ) as LatLon[] | LonLat[];

      if (validCoords.length === 0) {
        return null;
      }

      // Normalize to [lon, lat] for Turf (handles both formats)
      const coords = normalizeToLonLat(validCoords);
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
