import type { LatLon, Bounds, GeohashPoint, GeohashArea, H3Point, H3Area } from '../types';
import { decodeGeohash, geohashBounds, encodeGeohash } from '../geohash';
import { h3ToCoordinates, h3ToBoundary, coordinatesToH3 } from '../h3';

/**
 * Check if a string is a valid Geohash
 *
 * @param value - String to check
 * @returns true if the value is a valid geohash format
 *
 * @example
 * ```typescript
 * isGeohash('dr5regw3p'); // true
 * isGeohash('892a1072c97ffff'); // false (H3 format)
 * ```
 */
export function isGeohash(value: string): boolean {
  if (!value || typeof value !== 'string' || value.length === 0) {
    return false;
  }

  // Geohash uses base32: 0-9, b-z excluding a, i, l, o
  const validChars = /^[0-9b-hjkmnp-z]+$/;
  return validChars.test(value);
}

/**
 * Check if a string is a valid H3 index
 *
 * @param value - String to check
 * @returns true if the value is a valid H3 format
 *
 * @example
 * ```typescript
 * isH3('892a1072c97ffff'); // true
 * isH3('dr5regw3p'); // false (Geohash format)
 * ```
 */
export function isH3(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // H3 indices are hexadecimal and typically 15 characters
  const validH3 = /^[0-9a-f]{15}$/i;
  return validH3.test(value);
}

/**
 * Type guard to check if a value is a GeohashPoint
 * Note: At runtime, we can only validate the format, not the semantic meaning
 *
 * @param value - String to check
 * @returns true if the value can be used as a GeohashPoint
 */
export function isGeohashPoint(value: string): value is GeohashPoint {
  return isGeohash(value);
}

/**
 * Type guard to check if a value is a GeohashArea
 * Note: At runtime, we can only validate the format, not the semantic meaning
 *
 * @param value - String to check
 * @returns true if the value can be used as a GeohashArea
 */
export function isGeohashArea(value: string): value is GeohashArea {
  return isGeohash(value);
}

/**
 * Type guard to check if a value is an H3Point
 * Note: At runtime, we can only validate the format, not the semantic meaning
 *
 * @param value - String to check
 * @returns true if the value can be used as an H3Point
 */
export function isH3Point(value: string): value is H3Point {
  return isH3(value);
}

/**
 * Type guard to check if a value is an H3Area
 * Note: At runtime, we can only validate the format, not the semantic meaning
 *
 * @param value - String to check
 * @returns true if the value can be used as an H3Area
 */
export function isH3Area(value: string): value is H3Area {
  return isH3(value);
}

/**
 * Determine the type of spatial index
 *
 * @param value - String to check
 * @returns 'geohash', 'h3', or 'unknown'
 *
 * @example
 * ```typescript
 * getSpatialIndexType('dr5regw3p'); // 'geohash'
 * getSpatialIndexType('892a1072c97ffff'); // 'h3'
 * getSpatialIndexType('invalid'); // 'unknown'
 * ```
 */
export function getSpatialIndexType(value: string): 'geohash' | 'h3' | 'unknown' {
  if (isH3(value)) return 'h3';
  if (isGeohash(value)) return 'geohash';
  return 'unknown';
}

/**
 * Create a GeohashPoint from a string (with runtime validation)
 *
 * @param hash - Geohash string
 * @returns Branded GeohashPoint type
 * @throws Error if the string is not a valid geohash
 *
 * @example
 * ```typescript
 * const point = asGeohashPoint('dr5regw3p');
 * ```
 */
export function asGeohashPoint(hash: string): GeohashPoint {
  if (!isGeohash(hash)) {
    throw new Error(`Invalid geohash format: ${hash}`);
  }
  return hash as GeohashPoint;
}

/**
 * Create a GeohashArea from a string (with runtime validation)
 *
 * @param hash - Geohash string
 * @returns Branded GeohashArea type
 * @throws Error if the string is not a valid geohash
 *
 * @example
 * ```typescript
 * const area = asGeohashArea('dr5r');
 * ```
 */
export function asGeohashArea(hash: string): GeohashArea {
  if (!isGeohash(hash)) {
    throw new Error(`Invalid geohash format: ${hash}`);
  }
  return hash as GeohashArea;
}

/**
 * Create an H3Point from a string (with runtime validation)
 *
 * @param index - H3 index string
 * @returns Branded H3Point type
 * @throws Error if the string is not a valid H3 index
 *
 * @example
 * ```typescript
 * const point = asH3Point('892a1072c97ffff');
 * ```
 */
export function asH3Point(index: string): H3Point {
  if (!isH3(index)) {
    throw new Error(`Invalid H3 format: ${index}`);
  }
  return index as H3Point;
}

/**
 * Create an H3Area from a string (with runtime validation)
 *
 * @param index - H3 index string
 * @returns Branded H3Area type
 * @throws Error if the string is not a valid H3 index
 *
 * @example
 * ```typescript
 * const area = asH3Area('892a1072c97ffff');
 * ```
 */
export function asH3Area(index: string): H3Area {
  if (!isH3(index)) {
    throw new Error(`Invalid H3 format: ${index}`);
  }
  return index as H3Area;
}

/**
 * Convert a GeohashPoint to an H3Point
 *
 * @param geohash - GeohashPoint to convert
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Converted H3Point
 *
 * @example
 * ```typescript
 * const geohashPt = asGeohashPoint('dr5regw3p');
 * const h3Pt = geohashPointToH3Point(geohashPt, 9);
 * ```
 */
export function geohashPointToH3Point(geohash: GeohashPoint, resolution: number = 9): H3Point {
  const coords = decodeGeohash(geohash);
  const h3Index = coordinatesToH3(coords, resolution);
  return h3Index as H3Point;
}

/**
 * Convert a GeohashArea to an H3Area
 *
 * @param geohash - GeohashArea to convert
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Converted H3Area
 *
 * @example
 * ```typescript
 * const geohashArea = asGeohashArea('dr5r');
 * const h3Area = geohashAreaToH3Area(geohashArea, 7);
 * ```
 */
export function geohashAreaToH3Area(geohash: GeohashArea, resolution: number = 9): H3Area {
  const coords = decodeGeohash(geohash);
  const h3Index = coordinatesToH3(coords, resolution);
  return h3Index as H3Area;
}

/**
 * Convert an H3Point to a GeohashPoint
 *
 * @param h3 - H3Point to convert
 * @param precision - Geohash precision (default: 10)
 * @returns Converted GeohashPoint
 *
 * @example
 * ```typescript
 * const h3Pt = asH3Point('892a1072c97ffff');
 * const geohashPt = h3PointToGeohashPoint(h3Pt, 9);
 * ```
 */
export function h3PointToGeohashPoint(h3: H3Point, precision: number = 10): GeohashPoint {
  const coords = h3ToCoordinates(h3);
  const geohash = encodeGeohash(coords, precision);
  return geohash as GeohashPoint;
}

/**
 * Convert an H3Area to a GeohashArea
 *
 * @param h3 - H3Area to convert
 * @param precision - Geohash precision (default: 10)
 * @returns Converted GeohashArea
 *
 * @example
 * ```typescript
 * const h3Area = asH3Area('892a1072c97ffff');
 * const geohashArea = h3AreaToGeohashArea(h3Area, 7);
 * ```
 */
export function h3AreaToGeohashArea(h3: H3Area, precision: number = 10): GeohashArea {
  const coords = h3ToCoordinates(h3);
  const geohash = encodeGeohash(coords, precision);
  return geohash as GeohashArea;
}

/**
 * Decode a point spatial index (Geohash or H3) to coordinates
 *
 * @param index - GeohashPoint or H3Point
 * @returns Coordinates in [latitude, longitude] format
 *
 * @example
 * ```typescript
 * const geohashPt = asGeohashPoint('dr5regw3p');
 * const coords1 = decodePointToCoordinates(geohashPt);
 *
 * const h3Pt = asH3Point('892a1072c97ffff');
 * const coords2 = decodePointToCoordinates(h3Pt);
 * ```
 */
export function decodePointToCoordinates(index: GeohashPoint | H3Point): LatLon {
  const type = getSpatialIndexType(index);

  if (type === 'geohash') {
    return decodeGeohash(index);
  } else if (type === 'h3') {
    return h3ToCoordinates(index);
  }

  throw new Error(`Unknown spatial index type: ${index}`);
}

/**
 * Decode an area spatial index (Geohash or H3) to coordinates
 *
 * @param index - GeohashArea or H3Area
 * @returns Coordinates in [latitude, longitude] format (center of area)
 *
 * @example
 * ```typescript
 * const geohashArea = asGeohashArea('dr5r');
 * const coords1 = decodeAreaToCoordinates(geohashArea);
 *
 * const h3Area = asH3Area('892a1072c97ffff');
 * const coords2 = decodeAreaToCoordinates(h3Area);
 * ```
 */
export function decodeAreaToCoordinates(index: GeohashArea | H3Area): LatLon {
  const type = getSpatialIndexType(index);

  if (type === 'geohash') {
    return decodeGeohash(index);
  } else if (type === 'h3') {
    return h3ToCoordinates(index);
  }

  throw new Error(`Unknown spatial index type: ${index}`);
}

/**
 * Get bounding box from a point spatial index
 *
 * @param index - GeohashPoint or H3Point
 * @returns Bounding box [minLon, minLat, maxLon, maxLat]
 *
 * @example
 * ```typescript
 * const geohashPt = asGeohashPoint('dr5regw3p');
 * const bounds = getBoundsFromPoint(geohashPt);
 * ```
 */
export function getBoundsFromPoint(index: GeohashPoint | H3Point): Bounds {
  const type = getSpatialIndexType(index);

  if (type === 'geohash') {
    return geohashBounds(index);
  } else if (type === 'h3') {
    const boundary = h3ToBoundary(index);
    const lats = boundary.map((coord) => coord[0]);
    const lons = boundary.map((coord) => coord[1]);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }

  throw new Error(`Unknown spatial index type: ${index}`);
}

/**
 * Get bounding box from an area spatial index
 *
 * @param index - GeohashArea or H3Area
 * @returns Bounding box [minLon, minLat, maxLon, maxLat]
 *
 * @example
 * ```typescript
 * const geohashArea = asGeohashArea('dr5r');
 * const bounds = getBoundsFromArea(geohashArea);
 * ```
 */
export function getBoundsFromArea(index: GeohashArea | H3Area): Bounds {
  const type = getSpatialIndexType(index);

  if (type === 'geohash') {
    return geohashBounds(index);
  } else if (type === 'h3') {
    const boundary = h3ToBoundary(index);
    const lats = boundary.map((coord) => coord[0]);
    const lons = boundary.map((coord) => coord[1]);
    return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
  }

  throw new Error(`Unknown spatial index type: ${index}`);
}
