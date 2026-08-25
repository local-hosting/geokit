import { latLngToCell, cellToLatLng, getResolution, isValidCell } from 'h3-js';
import type { LatLon } from '../types.js';

/**
 * Convert coordinates to H3 cell ID (curried)
 *
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Curried function that takes coordinates and returns H3 cell ID
 *
 * @example
 * ```typescript
 * const toH3Res9 = coordinatesToH3(9);
 * const h3Index = toH3Res9([40.7128, -74.0060]);
 * // '892a1072c97ffff'
 *
 * // Or use with map
 * const h3Indices = coordinates.map(coordinatesToH3(9));
 * ```
 */
export function coordinatesToH3(resolution: number = 9) {
  return (coordinates: LatLon): string => {
    const [lat, lon] = coordinates;
    return latLngToCell(lat, lon, resolution);
  };
}

/**
 * Convert H3 cell ID to coordinates
 *
 * @param h3Index - H3 cell ID
 * @returns Coordinate pair [lat, lon] (center of cell)
 *
 * @example
 * ```typescript
 * const coords = h3ToCoordinates('892a1072c97ffff');
 * // [40.7128, -74.0060]
 * ```
 */
export function h3ToCoordinates(h3Index: string): LatLon {
  const [lat, lng] = cellToLatLng(h3Index);
  return [lat, lng];
}

/**
 * Get the resolution of an H3 cell
 *
 * @param h3Index - H3 cell ID
 * @returns Resolution (0-15)
 *
 * @example
 * ```typescript
 * const res = h3GetResolution('892a1072c97ffff');
 * // 9
 * ```
 */
export function h3GetResolution(h3Index: string): number {
  return getResolution(h3Index);
}

/**
 * Validate an H3 cell ID
 *
 * @param h3Index - H3 cell ID to validate
 * @returns true if valid
 *
 * @example
 * ```typescript
 * validateH3('892a1072c97ffff'); // true
 * validateH3('invalid'); // false
 * ```
 */
export function validateH3(h3Index: string): boolean {
  return isValidCell(h3Index);
}

/**
 * Snap coordinates to the center of an H3 cell (curried)
 * Useful for aligning coordinates to H3 grid boundaries
 *
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns Curried function that takes coordinates and returns snapped coordinates
 *
 * @example
 * ```typescript
 * const snapToRes9 = snapToH3Cell(9);
 * const snapped = snapToRes9([40.7128, -74.0060]);
 * // Returns the center coordinates of the H3 cell containing the input point
 *
 * // Or use with map
 * const snappedCoords = coordinates.map(snapToH3Cell(9));
 * ```
 */
export function snapToH3Cell(resolution: number = 9) {
  return (coordinates: LatLon): LatLon => {
    const h3Index = coordinatesToH3(resolution)(coordinates);
    return h3ToCoordinates(h3Index);
  };
}
