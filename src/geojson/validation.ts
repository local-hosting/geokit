import type {
  FeatureCollection,
  Feature,
  Geometry,
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
  Position,
} from '../types';

/**
 * Validation result with success status and optional error message
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a GeoJSON Position (coordinate array)
 * Must be [longitude, latitude] or [longitude, latitude, elevation]
 */
export function isValidPosition(position: unknown): position is Position {
  if (!Array.isArray(position)) {
    return false;
  }

  if (position.length < 2 || position.length > 3) {
    return false;
  }

  const [lon, lat] = position;
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    return false;
  }

  // Validate coordinate ranges
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    return false;
  }

  // Optional elevation must be a number
  if (position.length === 3 && typeof position[2] !== 'number') {
    return false;
  }

  return true;
}

/**
 * Validate a Point geometry
 */
export function isValidPoint(geometry: unknown): geometry is Point {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'Point') {
    return false;
  }

  if (!('coordinates' in g)) {
    return false;
  }

  return isValidPosition(g.coordinates);
}

/**
 * Validate a LineString geometry
 */
export function isValidLineString(geometry: unknown): geometry is LineString {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'LineString') {
    return false;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return false;
  }

  const coords = g.coordinates as unknown[];
  if (coords.length < 2) {
    return false; // LineString must have at least 2 points
  }

  return coords.every((coord) => isValidPosition(coord));
}

/**
 * Validate a Polygon ring (array of positions)
 * First and last positions must be equal (closed ring)
 */
function isValidPolygonRing(ring: unknown): boolean {
  if (!Array.isArray(ring)) {
    return false;
  }

  if (ring.length < 4) {
    return false; // Need at least 4 points to form a closed ring (first == last)
  }

  const positions = ring as unknown[];
  if (!positions.every((pos) => isValidPosition(pos))) {
    return false;
  }

  // Check that ring is closed (first == last)
  const first = positions[0] as Position;
  const last = positions[positions.length - 1] as Position;

  // Compare coordinates (allowing for floating point precision)
  const lonEqual = Math.abs(first[0] - last[0]) < 1e-10;
  const latEqual = Math.abs(first[1] - last[1]) < 1e-10;
  const elevEqual =
    first.length === 2 || last.length === 2 || Math.abs((first[2] || 0) - (last[2] || 0)) < 1e-10;

  return lonEqual && latEqual && elevEqual;
}

/**
 * Validate a Polygon geometry
 */
export function isValidPolygon(geometry: unknown): geometry is Polygon {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'Polygon') {
    return false;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return false;
  }

  const rings = g.coordinates as unknown[];
  if (rings.length === 0) {
    return false; // Polygon must have at least one ring (exterior)
  }

  // First ring is exterior, rest are holes
  return rings.every((ring) => isValidPolygonRing(ring));
}

/**
 * Validate a MultiPoint geometry
 */
export function isValidMultiPoint(geometry: unknown): geometry is MultiPoint {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiPoint') {
    return false;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return false;
  }

  const coords = g.coordinates as unknown[];
  return coords.every((coord) => isValidPosition(coord));
}

/**
 * Validate a MultiLineString geometry
 */
export function isValidMultiLineString(geometry: unknown): geometry is MultiLineString {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiLineString') {
    return false;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return false;
  }

  const lineStrings = g.coordinates as unknown[];
  return lineStrings.every((lineString) => {
    if (!Array.isArray(lineString)) {
      return false;
    }
    if (lineString.length < 2) {
      return false;
    }
    return (lineString as unknown[]).every((coord) => isValidPosition(coord));
  });
}

/**
 * Validate a MultiPolygon geometry
 */
export function isValidMultiPolygon(geometry: unknown): geometry is MultiPolygon {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiPolygon') {
    return false;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return false;
  }

  const polygons = g.coordinates as unknown[];
  return polygons.every((polygon) => {
    if (!Array.isArray(polygon)) {
      return false;
    }
    return (polygon as unknown[]).every((ring) => isValidPolygonRing(ring));
  });
}

/**
 * Validate a GeometryCollection
 */
export function isValidGeometryCollection(geometry: unknown): geometry is GeometryCollection {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'GeometryCollection') {
    return false;
  }

  if (!('geometries' in g) || !Array.isArray(g.geometries)) {
    return false;
  }

  const geometries = g.geometries as unknown[];
  return geometries.every((geom) => isValidGeometry(geom));
}

/**
 * Validate any Geometry type
 */
export function isValidGeometry(geometry: unknown): geometry is Geometry {
  if (!geometry || typeof geometry !== 'object') {
    return false;
  }

  const g = geometry as Record<string, unknown>;
  const type = g.type;

  switch (type) {
    case 'Point':
      return isValidPoint(geometry);
    case 'LineString':
      return isValidLineString(geometry);
    case 'Polygon':
      return isValidPolygon(geometry);
    case 'MultiPoint':
      return isValidMultiPoint(geometry);
    case 'MultiLineString':
      return isValidMultiLineString(geometry);
    case 'MultiPolygon':
      return isValidMultiPolygon(geometry);
    case 'GeometryCollection':
      return isValidGeometryCollection(geometry);
    default:
      return false;
  }
}

/**
 * Validate a GeoJSON Feature
 */
export function isValidFeature(feature: unknown): feature is Feature {
  if (!feature || typeof feature !== 'object') {
    return false;
  }

  const f = feature as Record<string, unknown>;
  if (f.type !== 'Feature') {
    return false;
  }

  if (!('geometry' in f)) {
    return false;
  }

  // Geometry can be null (allowed in GeoJSON spec)
  if (f.geometry === null) {
    return true;
  }

  if (!isValidGeometry(f.geometry)) {
    return false;
  }

  // Properties is optional, but if present must be an object
  if ('properties' in f && f.properties !== null && typeof f.properties !== 'object') {
    return false;
  }

  return true;
}

/**
 * Validate a GeoJSON FeatureCollection
 */
export function isValidFeatureCollection(collection: unknown): collection is FeatureCollection {
  if (!collection || typeof collection !== 'object') {
    return false;
  }

  const fc = collection as Record<string, unknown>;
  if (fc.type !== 'FeatureCollection') {
    return false;
  }

  if (!('features' in fc) || !Array.isArray(fc.features)) {
    return false;
  }

  const features = fc.features as unknown[];
  return features.every((feature) => isValidFeature(feature));
}

/**
 * Validate GeoJSON and return a result object with error message if invalid
 */
export function validateGeoJSON(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return {
      valid: false,
      error: 'Input must be an object',
    };
  }

  const obj = input as Record<string, unknown>;

  // Check for FeatureCollection
  if ('type' in obj && obj.type === 'FeatureCollection') {
    if (isValidFeatureCollection(input)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid FeatureCollection structure',
    };
  }

  // Check for Feature
  if ('type' in obj && obj.type === 'Feature') {
    if (isValidFeature(input)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid Feature structure',
    };
  }

  // Check for Geometry
  if ('type' in obj && 'coordinates' in obj) {
    if (isValidGeometry(input)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: 'Invalid Geometry structure',
    };
  }

  return {
    valid: false,
    error: 'Input is not a valid GeoJSON object (must be FeatureCollection, Feature, or Geometry)',
  };
}
