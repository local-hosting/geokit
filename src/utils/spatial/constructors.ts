import type { GeohashPoint, GeohashArea, H3Point, H3Area } from '../types';
import { isGeohash, isH3 } from './type-guards';

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
