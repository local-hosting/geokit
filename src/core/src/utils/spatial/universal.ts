import type { LatLon, Bounds, GeohashPoint, GeohashArea, H3Point, H3Area } from '../../types';
import { decodeGeohash, geohashBounds } from '../geohash';
import { h3ToCoordinates, h3ToBoundary } from '@local-hosting/geokit/h3';
import { getSpatialIndexType } from './type-guards';

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
