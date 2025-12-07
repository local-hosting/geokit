import type { GeohashPoint, GeohashArea, H3Point, H3Area } from '../types';
import { decodeGeohash, encodeGeohash } from '../geohash';
import { h3ToCoordinates, coordinatesToH3 } from '../h3';

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
