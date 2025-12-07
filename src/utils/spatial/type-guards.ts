import type { GeohashPoint, GeohashArea, H3Point, H3Area } from '../types';

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
