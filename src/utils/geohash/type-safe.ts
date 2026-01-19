import Geohash from 'latlon-geohash';
import type { LatLon, GeohashPoint, GeohashArea, Bounds } from '../../types';
import { geohashBounds } from './bounds';
import { geohashNeighbors } from './neighbors';

/**
 * Encode coordinates to a geohash point (type-safe, curried)
 *
 * @param precision - Length of geohash (default: 10)
 * @returns Curried function that takes coordinates and returns GeohashPoint
 *
 * @example
 * ```typescript
 * const encodePoint10 = encodeGeohashPoint(10);
 * const hashPoint = encodePoint10([40.7128, -74.0060]);
 * // This is now type-safe and can only be used with functions expecting GeohashPoint
 *
 * // Or use with map
 * const hashes = coordinates.map(encodeGeohashPoint(10));
 * ```
 */
export function encodeGeohashPoint(precision: number = 10) {
  return (coordinates: LatLon): GeohashPoint => {
    const [lat, lon] = coordinates;
    return Geohash.encode(lat, lon, precision) as GeohashPoint;
  };
}

/**
 * Encode coordinates to a geohash area (type-safe, curried)
 *
 * @param precision - Length of geohash (default: 10)
 * @returns Curried function that takes coordinates and returns GeohashArea
 *
 * @example
 * ```typescript
 * const encodeArea7 = encodeGeohashArea(7);
 * const hashArea = encodeArea7([40.7128, -74.0060]);
 * // This is now type-safe and can only be used with functions expecting GeohashArea
 *
 * // Or use with map
 * const areas = coordinates.map(encodeGeohashArea(7));
 * ```
 */
export function encodeGeohashArea(precision: number = 10) {
  return (coordinates: LatLon): GeohashArea => {
    const [lat, lon] = coordinates;
    return Geohash.encode(lat, lon, precision) as GeohashArea;
  };
}

/**
 * Decode a geohash point to coordinates (type-safe)
 *
 * @param hash - GeohashPoint
 * @returns Coordinate pair [lat, lon] (center of geohash box)
 *
 * @example
 * ```typescript
 * const hashPoint = encodeGeohashPoint([40.7128, -74.0060]);
 * const coords = decodeGeohashPoint(hashPoint);
 * // [40.7128, -74.0060]
 * ```
 */
export function decodeGeohashPoint(hash: GeohashPoint): LatLon {
  const { lat, lon } = Geohash.decode(hash);
  return [lat, lon];
}

/**
 * Decode a geohash area to coordinates (type-safe)
 *
 * @param hash - GeohashArea
 * @returns Coordinate pair [lat, lon] (center of geohash box)
 *
 * @example
 * ```typescript
 * const hashArea = encodeGeohashArea([40.7128, -74.0060], 7);
 * const coords = decodeGeohashArea(hashArea);
 * ```
 */
export function decodeGeohashArea(hash: GeohashArea): LatLon {
  const { lat, lon } = Geohash.decode(hash);
  return [lat, lon];
}

/**
 * Get the bounding box of a geohash point (type-safe)
 *
 * @param hash - GeohashPoint
 * @returns Bounding box [minLon, minLat, maxLon, maxLat]
 *
 * @example
 * ```typescript
 * const hashPoint = encodeGeohashPoint([40.7128, -74.0060]);
 * const bounds = geohashPointBounds(hashPoint);
 * ```
 */
export function geohashPointBounds(hash: GeohashPoint): Bounds {
  return geohashBounds(hash);
}

/**
 * Get the bounding box of a geohash area (type-safe)
 *
 * @param hash - GeohashArea
 * @returns Bounding box [minLon, minLat, maxLon, maxLat]
 *
 * @example
 * ```typescript
 * const hashArea = encodeGeohashArea([40.7128, -74.0060], 7);
 * const bounds = geohashAreaBounds(hashArea);
 * ```
 */
export function geohashAreaBounds(hash: GeohashArea): Bounds {
  return geohashBounds(hash);
}

/**
 * Get neighboring geohash points (type-safe)
 *
 * @param hash - GeohashPoint
 * @returns Array of 8 neighboring GeohashPoints [N, NE, E, SE, S, SW, W, NW]
 *
 * @example
 * ```typescript
 * const hashPoint = encodeGeohashPoint([40.7128, -74.0060]);
 * const neighbors = geohashPointNeighbors(hashPoint);
 * ```
 */
export function geohashPointNeighbors(hash: GeohashPoint): GeohashPoint[] {
  const neighbors = geohashNeighbors(hash);
  return [
    neighbors.n,
    neighbors.ne,
    neighbors.e,
    neighbors.se,
    neighbors.s,
    neighbors.sw,
    neighbors.w,
    neighbors.nw,
  ] as GeohashPoint[];
}

/**
 * Get neighboring geohash areas (type-safe)
 *
 * @param hash - GeohashArea
 * @returns Array of 8 neighboring GeohashAreas [N, NE, E, SE, S, SW, W, NW]
 *
 * @example
 * ```typescript
 * const hashArea = encodeGeohashArea([40.7128, -74.0060], 7);
 * const neighbors = geohashAreaNeighbors(hashArea);
 * ```
 */
export function geohashAreaNeighbors(hash: GeohashArea): GeohashArea[] {
  const neighbors = geohashNeighbors(hash);
  return [
    neighbors.n,
    neighbors.ne,
    neighbors.e,
    neighbors.se,
    neighbors.s,
    neighbors.sw,
    neighbors.w,
    neighbors.nw,
  ] as GeohashArea[];
}
