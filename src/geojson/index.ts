import type { Feature, FeatureCollection, Geometry, LonLat } from '../types';

export {
  isValidPosition,
  isValidPoint,
  isValidLineString,
  isValidPolygon,
  isValidMultiPoint,
  isValidMultiLineString,
  isValidMultiPolygon,
  isValidGeometryCollection,
  isValidGeometry,
  isValidFeature,
  isValidFeatureCollection,
  validateGeoJSON,
  type ValidationResult,
} from './validation';

export {
  repairGeometry,
  repairFeature,
  repairFeatureCollection,
  repairGeoJSON,
  type RepairOptions,
} from './repair';

export { fixPolygonRingOrder, filterTinyPolygons, cleanGeometry } from './polygon-utils';

/**
 * Extract coordinates from a GeoJSON feature or geometry
 *
 * @param input - GeoJSON Feature or Geometry
 * @returns Coordinates in [latitude, longitude] format, or null if not a Point
 *
 * @example
 * ```typescript
 * const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [-74.0060, 40.7128] } };
 * getCoordinates(feature); // [40.7128, -74.0060]
 * ```
 */
export function getCoordinates(input: Feature | Geometry): LonLat | null {
  let geometry: Geometry;

  if ('type' in input && input.type === 'Feature') {
    geometry = input.geometry;
  } else if ('type' in input && ('coordinates' in input || 'geometries' in input)) {
    geometry = input as Geometry;
  } else {
    return null;
  }

  if (geometry.type === 'Point' && geometry.coordinates) {
    return geometry.coordinates;
  }

  return null;
}

/**
 * Create a GeoJSON Feature from geometry and properties
 *
 * @param geometry - GeoJSON Geometry
 * @param properties - Optional properties object
 * @returns GeoJSON Feature
 *
 * @example
 * ```typescript
 * const point = { type: 'Point', coordinates: [-74.0060, 40.7128] };
 * const feature = createFeature(point, { name: 'New York' });
 * ```
 */
export function createFeature(geometry: Geometry, properties?: Record<string, unknown>): Feature {
  return {
    type: 'Feature',
    geometry,
    properties: properties || {},
  };
}

/**
 * Create a GeoJSON FeatureCollection from an array of features
 *
 * @param features - Array of GeoJSON Features
 * @returns GeoJSON FeatureCollection
 *
 * @example
 * ```typescript
 * const features = [
 *   createFeature(point1, { name: 'Location 1' }),
 *   createFeature(point2, { name: 'Location 2' })
 * ];
 * const collection = createFeatureCollection(features);
 * ```
 */
export function createFeatureCollection(features: Feature[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Extract geometry from a GeoJSON Feature
 *
 * @param feature - GeoJSON Feature
 * @returns Geometry object, or null if invalid
 *
 * @example
 * ```typescript
 * const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [-74.0060, 40.7128] } };
 * const geometry = extractGeometry(feature); // { type: 'Point', coordinates: [-74.0060, 40.7128] }
 * ```
 */
export function extractGeometry(feature: Feature | { geometry?: Geometry }): Geometry | null {
  if (!feature || typeof feature !== 'object') {
    return null;
  }

  if ('type' in feature && feature.type === 'Feature' && 'geometry' in feature) {
    return feature.geometry;
  }

  if ('geometry' in feature && feature.geometry) {
    return feature.geometry;
  }

  return null;
}

/**
 * Format GeoJSON with compressed coordinate arrays but readable structure
 * Compresses coordinate pairs [lon, lat] by removing whitespace while keeping the rest formatted
 *
 * @param obj - GeoJSON object (FeatureCollection, Feature, or Geometry)
 * @param minify - If true, fully minify JSON (remove all whitespace). Default: false
 * @returns Formatted JSON string with compressed coordinates
 *
 * @example
 * ```typescript
 * const fc = { type: 'FeatureCollection', features: [...] };
 * const formatted = formatJSONCompact(fc);
 * // Pretty printed JSON with compressed coordinate arrays like [lon,lat] instead of [lon, lat]
 * ```
 */
export function formatJSONCompact(
  obj: FeatureCollection | Feature | Geometry | unknown,
  minify: boolean = false
): string {
  if (minify) {
    // Fully minified - no whitespace at all
    return JSON.stringify(obj);
  } else {
    // Pretty printed but with compressed coordinate arrays
    const formatted = JSON.stringify(obj, null, 2);
    // Compress coordinate pairs [lon, lat] - remove extra whitespace
    return formatted.replace(/\[\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\]/g, '[$1,$2]');
  }
}
