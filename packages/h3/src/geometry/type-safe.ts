import { latLngToCell, cellToLatLng, cellToBoundary, gridDisk } from 'h3-js';
import type { LatLon, Polygon, H3Point, H3Area } from '../types.js';
import { h3ToPolygon } from './boundary.js';

/**
 * Convert coordinates to H3 point (type-safe, curried)
 *
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Curried function that takes coordinates and returns H3Point
 *
 * @example
 * ```typescript
 * const toH3Point9 = coordinatesToH3Point(9);
 * const h3Point = toH3Point9([40.7128, -74.0060]);
 * // This is now type-safe and can only be used with functions expecting H3Point
 *
 * // Or use with map
 * const h3Points = coordinates.map(coordinatesToH3Point(9));
 * ```
 */
export function coordinatesToH3Point(resolution: number = 9) {
  return (coordinates: LatLon): H3Point => {
    const [lat, lon] = coordinates;
    return latLngToCell(lat, lon, resolution) as H3Point;
  };
}

/**
 * Convert coordinates to H3 area (type-safe, curried)
 *
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Curried function that takes coordinates and returns H3Area
 *
 * @example
 * ```typescript
 * const toH3Area7 = coordinatesToH3Area(7);
 * const h3Area = toH3Area7([40.7128, -74.0060]);
 * // This is now type-safe and can only be used with functions expecting H3Area
 *
 * // Or use with map
 * const h3Areas = coordinates.map(coordinatesToH3Area(7));
 * ```
 */
export function coordinatesToH3Area(resolution: number = 9) {
  return (coordinates: LatLon): H3Area => {
    const [lat, lon] = coordinates;
    return latLngToCell(lat, lon, resolution) as H3Area;
  };
}

/**
 * Convert H3 point to coordinates (type-safe)
 *
 * @param h3Index - H3Point
 * @returns Coordinate pair [lat, lon] (center of cell)
 *
 * @example
 * ```typescript
 * const h3Point = coordinatesToH3Point([40.7128, -74.0060]);
 * const coords = h3PointToCoordinates(h3Point);
 * ```
 */
export function h3PointToCoordinates(h3Index: H3Point): LatLon {
  const [lat, lng] = cellToLatLng(h3Index);
  return [lat, lng];
}

/**
 * Convert H3 area to coordinates (type-safe)
 *
 * @param h3Index - H3Area
 * @returns Coordinate pair [lat, lon] (center of cell)
 *
 * @example
 * ```typescript
 * const h3Area = coordinatesToH3Area([40.7128, -74.0060], 7);
 * const coords = h3AreaToCoordinates(h3Area);
 * ```
 */
export function h3AreaToCoordinates(h3Index: H3Area): LatLon {
  const [lat, lng] = cellToLatLng(h3Index);
  return [lat, lng];
}

/**
 * Get the boundary of an H3 point as a polygon (type-safe)
 *
 * @param h3Index - H3Point
 * @returns Array of coordinate pairs forming the cell boundary
 *
 * @example
 * ```typescript
 * const h3Point = coordinatesToH3Point([40.7128, -74.0060]);
 * const boundary = h3PointToBoundary(h3Point);
 * ```
 */
export function h3PointToBoundary(h3Index: H3Point): LatLon[] {
  const boundary = cellToBoundary(h3Index);
  return boundary.map(([lat, lng]) => [lat, lng] as LatLon);
}

/**
 * Convert H3 point to GeoJSON Polygon (type-safe)
 *
 * @param h3Index - H3Point
 * @returns GeoJSON Polygon geometry
 *
 * @example
 * ```typescript
 * const h3Point = coordinatesToH3Point([40.7128, -74.0060]);
 * const polygon = h3PointToPolygon(h3Point);
 * ```
 */
export function h3PointToPolygon(h3Index: H3Point): Polygon {
  const polygon = h3ToPolygon(h3Index);
  if (!polygon) {
    throw new Error(`Invalid H3 index: ${h3Index}`);
  }
  return polygon;
}

/**
 * Get the boundary of an H3 area as a polygon (type-safe)
 *
 * @param h3Index - H3Area
 * @returns Array of coordinate pairs forming the cell boundary
 *
 * @example
 * ```typescript
 * const h3Area = coordinatesToH3Area([40.7128, -74.0060], 7);
 * const boundary = h3AreaToBoundary(h3Area);
 * ```
 */
export function h3AreaToBoundary(h3Index: H3Area): LatLon[] {
  const boundary = cellToBoundary(h3Index);
  return boundary.map(([lat, lng]) => [lat, lng] as LatLon);
}

/**
 * Convert H3 area to GeoJSON Polygon (type-safe)
 *
 * @param h3Index - H3Area
 * @returns GeoJSON Polygon geometry
 *
 * @example
 * ```typescript
 * const h3Area = coordinatesToH3Area([40.7128, -74.0060], 7);
 * const polygon = h3AreaToPolygon(h3Area);
 * ```
 */
export function h3AreaToPolygon(h3Index: H3Area): Polygon {
  const polygon = h3ToPolygon(h3Index);
  if (!polygon) {
    throw new Error(`Invalid H3 index: ${h3Index}`);
  }
  return polygon;
}

/**
 * Get neighboring H3 points (k-ring) (type-safe)
 *
 * @param h3Index - H3Point
 * @param k - Ring size (default: 1)
 * @returns Array of H3Point IDs in the k-ring
 *
 * @example
 * ```typescript
 * const h3Point = coordinatesToH3Point([40.7128, -74.0060]);
 * const neighbors = h3PointNeighbors(h3Point, 1);
 * ```
 */
export function h3PointNeighbors(h3Index: H3Point, k: number = 1): H3Point[] {
  return gridDisk(h3Index, k) as H3Point[];
}

/**
 * Get neighboring H3 areas (k-ring) (type-safe)
 *
 * @param h3Index - H3Area
 * @param k - Ring size (default: 1)
 * @returns Array of H3Area IDs in the k-ring
 *
 * @example
 * ```typescript
 * const h3Area = coordinatesToH3Area([40.7128, -74.0060], 7);
 * const neighbors = h3AreaNeighbors(h3Area, 1);
 * ```
 */
export function h3AreaNeighbors(h3Index: H3Area, k: number = 1): H3Area[] {
  return gridDisk(h3Index, k) as H3Area[];
}
