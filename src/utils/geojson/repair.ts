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
  Position,
} from '../../types';
import { roundCoordinate } from '../coordinates/manipulation';

/**
 * Repair options for fixing GeoJSON
 */
export interface RepairOptions {
  /**
   * Close unclosed polygon rings (add last point if missing)
   * @default true
   */
  closeRings?: boolean;
  /**
   * Remove duplicate consecutive coordinates
   * @default true
   */
  removeDuplicates?: boolean;
  /**
   * Remove invalid positions (out of range coordinates)
   * @default true
   */
  removeInvalidPositions?: boolean;
  /**
   * Round coordinates to specified decimal places (helps with precision issues)
   * @default undefined (no rounding)
   */
  coordinatePrecision?: number;
  /**
   * Remove empty geometries
   * @default true
   */
  removeEmptyGeometries?: boolean;
  /**
   * Remove features with null geometries
   * @default false
   */
  removeNullGeometries?: boolean;
}

/**
 * Repair a GeoJSON Position (coordinate)
 */
function repairPosition(position: unknown, options: RepairOptions): Position | null {
  if (!Array.isArray(position)) {
    return null;
  }

  if (position.length < 2) {
    return null;
  }

  const [lon, lat] = position;
  if (typeof lon !== 'number' || typeof lat !== 'number') {
    return null;
  }

  // Check coordinate ranges
  if (options.removeInvalidPositions !== false) {
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      return null;
    }
  }

  // Round coordinates if specified
  let fixedLon = lon;
  let fixedLat = lat;
  if (options.coordinatePrecision !== undefined) {
    fixedLon = roundCoordinate(lon, options.coordinatePrecision);
    fixedLat = roundCoordinate(lat, options.coordinatePrecision);
  }

  // Handle optional elevation
  if (position.length === 3) {
    const elev = typeof position[2] === 'number' ? position[2] : 0;
    return [fixedLon, fixedLat, elev];
  }

  return [fixedLon, fixedLat];
}

/**
 * Remove duplicate consecutive coordinates from an array
 */
function removeDuplicateCoordinates<T extends Position[]>(
  coordinates: T,
  options: RepairOptions
): T {
  if (!options.removeDuplicates || coordinates.length <= 1) {
    return coordinates;
  }

  const cleaned: Position[] = [];
  let lastCoord: Position | null = null;

  for (const coord of coordinates) {
    if (lastCoord === null || coord[0] !== lastCoord[0] || coord[1] !== lastCoord[1]) {
      cleaned.push(coord);
      lastCoord = coord;
    }
  }

  return cleaned as T;
}

/**
 * Repair a polygon ring (close it if needed, remove duplicates)
 */
function repairPolygonRing(ring: unknown, options: RepairOptions): Position[] | null {
  if (!Array.isArray(ring)) {
    return null;
  }

  if (ring.length < 3) {
    return null; // Need at least 3 points (will be 4 after closing)
  }

  // Repair positions
  const positions: Position[] = [];
  for (const pos of ring) {
    const repaired = repairPosition(pos, options);
    if (repaired) {
      positions.push(repaired);
    }
  }

  if (positions.length < 3) {
    return null;
  }

  // Remove duplicate consecutive coordinates
  const cleaned = removeDuplicateCoordinates(positions, options);

  // Close ring if needed
  if (options.closeRings !== false && cleaned.length > 0) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];

    // Check if ring is closed (allowing for floating point precision)
    const isClosed = Math.abs(first[0] - last[0]) < 1e-10 && Math.abs(first[1] - last[1]) < 1e-10;

    if (!isClosed) {
      cleaned.push([first[0], first[1], ...(first.length > 2 ? [first[2]] : [])]);
    }
  }

  return cleaned.length >= 4 ? cleaned : null; // Need at least 4 points for closed ring
}

/**
 * Repair a Point geometry
 */
function repairPoint(geometry: unknown, options: RepairOptions): Point | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'Point') {
    return null;
  }

  if (!('coordinates' in g)) {
    return null;
  }

  const position = repairPosition(g.coordinates, options);
  if (!position) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: position,
  };
}

/**
 * Repair a LineString geometry
 */
function repairLineString(geometry: unknown, options: RepairOptions): LineString | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'LineString') {
    return null;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return null;
  }

  const positions: Position[] = [];
  for (const pos of g.coordinates as unknown[]) {
    const repaired = repairPosition(pos, options);
    if (repaired) {
      positions.push(repaired);
    }
  }

  if (positions.length < 2) {
    return null; // LineString needs at least 2 points
  }

  const cleaned = removeDuplicateCoordinates(positions, options);

  return cleaned.length >= 2
    ? {
        type: 'LineString',
        coordinates: cleaned,
      }
    : null;
}

/**
 * Repair a Polygon geometry
 */
function repairPolygon(geometry: unknown, options: RepairOptions): Polygon | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'Polygon') {
    return null;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return null;
  }

  const rings: Position[][] = [];
  for (const ring of g.coordinates as unknown[]) {
    const repaired = repairPolygonRing(ring, options);
    if (repaired) {
      rings.push(repaired);
    }
  }

  if (rings.length === 0) {
    return null; // Polygon needs at least one ring
  }

  return {
    type: 'Polygon',
    coordinates: rings,
  };
}

/**
 * Repair a MultiPoint geometry
 */
function repairMultiPoint(geometry: unknown, options: RepairOptions): MultiPoint | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiPoint') {
    return null;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return null;
  }

  const positions: Position[] = [];
  for (const pos of g.coordinates as unknown[]) {
    const repaired = repairPosition(pos, options);
    if (repaired) {
      positions.push(repaired);
    }
  }

  if (options.removeEmptyGeometries !== false && positions.length === 0) {
    return null;
  }

  return positions.length > 0
    ? {
        type: 'MultiPoint',
        coordinates: positions,
      }
    : null;
}

/**
 * Repair a MultiLineString geometry
 */
function repairMultiLineString(geometry: unknown, options: RepairOptions): MultiLineString | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiLineString') {
    return null;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return null;
  }

  const lineStrings: Position[][] = [];
  for (const lineString of g.coordinates as unknown[]) {
    if (!Array.isArray(lineString)) {
      continue;
    }

    const positions: Position[] = [];
    for (const pos of lineString as unknown[]) {
      const repaired = repairPosition(pos, options);
      if (repaired) {
        positions.push(repaired);
      }
    }

    const cleaned = removeDuplicateCoordinates(positions, options);
    if (cleaned.length >= 2) {
      lineStrings.push(cleaned);
    }
  }

  if (options.removeEmptyGeometries !== false && lineStrings.length === 0) {
    return null;
  }

  return lineStrings.length > 0
    ? {
        type: 'MultiLineString',
        coordinates: lineStrings,
      }
    : null;
}

/**
 * Repair a MultiPolygon geometry
 */
function repairMultiPolygon(geometry: unknown, options: RepairOptions): MultiPolygon | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  if (g.type !== 'MultiPolygon') {
    return null;
  }

  if (!('coordinates' in g) || !Array.isArray(g.coordinates)) {
    return null;
  }

  const polygons: Position[][][] = [];
  for (const polygon of g.coordinates as unknown[]) {
    if (!Array.isArray(polygon)) {
      continue;
    }

    const rings: Position[][] = [];
    for (const ring of polygon as unknown[]) {
      const repaired = repairPolygonRing(ring, options);
      if (repaired) {
        rings.push(repaired);
      }
    }

    if (rings.length > 0) {
      polygons.push(rings);
    }
  }

  if (options.removeEmptyGeometries !== false && polygons.length === 0) {
    return null;
  }

  return polygons.length > 0
    ? {
        type: 'MultiPolygon',
        coordinates: polygons,
      }
    : null;
}

/**
 * Repair any Geometry type
 */
export function repairGeometry(geometry: unknown, options: RepairOptions = {}): Geometry | null {
  if (!geometry || typeof geometry !== 'object') {
    return null;
  }

  const g = geometry as Record<string, unknown>;
  const type = g.type;

  switch (type) {
    case 'Point':
      return repairPoint(geometry, options);
    case 'LineString':
      return repairLineString(geometry, options);
    case 'Polygon':
      return repairPolygon(geometry, options);
    case 'MultiPoint':
      return repairMultiPoint(geometry, options);
    case 'MultiLineString':
      return repairMultiLineString(geometry, options);
    case 'MultiPolygon':
      return repairMultiPolygon(geometry, options);
    default:
      return null;
  }
}

/**
 * Repair a GeoJSON Feature
 */
export function repairFeature(feature: unknown, options: RepairOptions = {}): Feature | null {
  if (!feature || typeof feature !== 'object') {
    return null;
  }

  const f = feature as Record<string, unknown>;
  if (f.type !== 'Feature') {
    return null;
  }

  // Handle null geometry
  if (f.geometry === null) {
    if (options.removeNullGeometries) {
      return null;
    }
    return {
      type: 'Feature',
      geometry: null,
      properties: (f.properties as Record<string, unknown>) || {},
    } as unknown as Feature;
  }

  // Repair geometry
  const repairedGeometry = repairGeometry(f.geometry, options);
  if (!repairedGeometry) {
    if (options.removeEmptyGeometries !== false) {
      return null;
    }
    // Return feature with null geometry if we can't repair it
    return {
      type: 'Feature',
      geometry: null,
      properties: (f.properties as Record<string, unknown>) || {},
    } as unknown as Feature;
  }

  return {
    type: 'Feature',
    geometry: repairedGeometry,
    properties: (f.properties as Record<string, unknown>) || {},
  };
}

/**
 * Repair a GeoJSON FeatureCollection
 */
export function repairFeatureCollection(
  collection: unknown,
  options: RepairOptions = {}
): FeatureCollection {
  if (!collection || typeof collection !== 'object') {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const fc = collection as Record<string, unknown>;
  if (fc.type !== 'FeatureCollection') {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  if (!('features' in fc) || !Array.isArray(fc.features)) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const features: Feature[] = [];
  for (const feature of fc.features as unknown[]) {
    const repaired = repairFeature(feature, options);
    if (repaired) {
      features.push(repaired);
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Repair GeoJSON (auto-detects type and repairs accordingly)
 */
export function repairGeoJSON(
  input: unknown,
  options: RepairOptions = {}
): FeatureCollection | Feature | Geometry | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const obj = input as Record<string, unknown>;

  // Check for FeatureCollection
  if ('type' in obj && obj.type === 'FeatureCollection') {
    return repairFeatureCollection(input, options);
  }

  // Check for Feature
  if ('type' in obj && obj.type === 'Feature') {
    return repairFeature(input, options);
  }

  // Check for Geometry
  if ('type' in obj && 'coordinates' in obj) {
    return repairGeometry(input, options);
  }

  return null;
}
