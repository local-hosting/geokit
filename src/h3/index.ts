import {
  latLngToCell,
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  cellToParent,
  cellToChildren,
  getResolution,
  isValidCell,
  areNeighborCells,
  cellsToMultiPolygon,
  polygonToCells,
  getHexagonEdgeLengthAvg,
  getHexagonAreaAvg,
} from 'h3-js';
import type { LatLon, Polygon } from '../types';

/**
 * Convert coordinates to H3 cell ID
 *
 * @param coordinates - Coordinate pair [lat, lon]
 * @param resolution - H3 resolution (0-15, default: 9)
 * @returns H3 cell ID
 *
 * @example
 * ```typescript
 * const h3Index = coordinatesToH3([40.7128, -74.0060], 9);
 * // '892a1072c97ffff'
 * ```
 */
export function coordinatesToH3(coordinates: LatLon, resolution: number = 9): string {
  const [lat, lon] = coordinates;
  return latLngToCell(lat, lon, resolution);
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
 * Get the boundary of an H3 cell as a polygon
 *
 * @param h3Index - H3 cell ID
 * @returns Array of coordinate pairs forming the cell boundary
 *
 * @example
 * ```typescript
 * const boundary = h3ToBoundary('892a1072c97ffff');
 * // [[lat1, lon1], [lat2, lon2], ...]
 * ```
 */
export function h3ToBoundary(h3Index: string): LatLon[] {
  const boundary = cellToBoundary(h3Index);
  return boundary.map(([lat, lng]) => [lat, lng] as LatLon);
}

/**
 * Get neighboring H3 cells (k-ring)
 *
 * @param h3Index - H3 cell ID
 * @param k - Ring size (default: 1)
 * @returns Array of H3 cell IDs in the k-ring
 *
 * @example
 * ```typescript
 * const neighbors = h3Neighbors('892a1072c97ffff', 1);
 * // ['892a1072c97ffff', '892a1072c87ffff', ...]
 * ```
 */
export function h3Neighbors(h3Index: string, k: number = 1): string[] {
  return gridDisk(h3Index, k);
}

/**
 * Get the parent cell at a coarser resolution
 *
 * @param h3Index - H3 cell ID
 * @param resolution - Target resolution (must be less than current)
 * @returns Parent H3 cell ID
 *
 * @example
 * ```typescript
 * const parent = h3ToParent('892a1072c97ffff', 8);
 * ```
 */
export function h3ToParent(h3Index: string, resolution: number): string {
  return cellToParent(h3Index, resolution);
}

/**
 * Get the children cells at a finer resolution
 *
 * @param h3Index - H3 cell ID
 * @param resolution - Target resolution (must be greater than current)
 * @returns Array of child H3 cell IDs
 *
 * @example
 * ```typescript
 * const children = h3ToChildren('892a1072c97ffff', 10);
 * ```
 */
export function h3ToChildren(h3Index: string, resolution: number): string[] {
  return cellToChildren(h3Index, resolution);
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
 * Check if two H3 cells are neighbors
 *
 * @param h3Index1 - First H3 cell ID
 * @param h3Index2 - Second H3 cell ID
 * @returns true if cells are neighbors
 *
 * @example
 * ```typescript
 * const areNeighbors = h3AreNeighbors('892a1072c97ffff', '892a1072c87ffff');
 * ```
 */
export function h3AreNeighbors(h3Index1: string, h3Index2: string): boolean {
  return areNeighborCells(h3Index1, h3Index2);
}

/**
 * Convert H3 cells to a GeoJSON MultiPolygon
 *
 * @param h3Indices - Array of H3 cell IDs
 * @returns GeoJSON MultiPolygon geometry
 *
 * @example
 * ```typescript
 * const multiPolygon = h3SetToMultiPolygon(['892a1072c97ffff', '892a1072c87ffff']);
 * ```
 */
export function h3SetToMultiPolygon(h3Indices: string[]): {
  type: 'MultiPolygon';
  coordinates: number[][][][];
} {
  const coords = cellsToMultiPolygon(h3Indices, true);
  return {
    type: 'MultiPolygon',
    coordinates: coords,
  };
}

/**
 * Fill a polygon with H3 cells
 *
 * @param polygon - GeoJSON Polygon
 * @param resolution - H3 resolution
 * @returns Array of H3 cell IDs covering the polygon
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.01, 40.7], [-74.0, 40.7], [-74.0, 40.71], [-74.01, 40.71], [-74.01, 40.7]]]
 * };
 * const cells = polygonToH3(polygon, 9);
 * ```
 */
export function polygonToH3(polygon: Polygon, resolution: number): string[] {
  // Convert our Polygon type to h3-js format
  const h3Polygon = polygon.coordinates.map((ring) => ring.map(([lon, lat]) => [lat, lon]));
  return polygonToCells(h3Polygon, resolution, true);
}

/**
 * Get the average edge length of H3 cells at a given resolution (in meters)
 *
 * @param resolution - H3 resolution (0-15)
 * @returns Average edge length in meters
 *
 * @example
 * ```typescript
 * const edgeLength = h3EdgeLength(9);
 * // ~174.375668 meters
 * ```
 */
export function h3EdgeLength(resolution: number): number {
  return getHexagonEdgeLengthAvg(resolution, 'm');
}

/**
 * Get the average area of H3 cells at a given resolution (in square meters)
 *
 * @param resolution - H3 resolution (0-15)
 * @returns Average area in square meters
 *
 * @example
 * ```typescript
 * const area = h3CellArea(9);
 * // ~105461.5 square meters
 * ```
 */
export function h3CellArea(resolution: number): number {
  return getHexagonAreaAvg(resolution, 'm2');
}
