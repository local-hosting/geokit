import { cellsToMultiPolygon, polygonToCells } from 'h3-js';
import type { Polygon } from '../types';

/**
 * Convert H3 cells to a GeoJSON MultiPolygon
 *
 * @param h3Indices - Array of H3 cell IDs
 * @returns GeoJSON MultiPolygon geometry with [lng, lat] coordinates
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
  // h3-js cellsToMultiPolygon returns [lat, lng] format
  // Convert to GeoJSON [lng, lat] format
  const h3Coords = cellsToMultiPolygon(h3Indices, true);
  
  // Swap [lat, lng] to [lng, lat] for each coordinate
  const geoJsonCoords = h3Coords.map((polygon) =>
    polygon.map((ring) =>
      ring.map(([lat, lng]) => [lng, lat])
    )
  );
  
  return {
    type: 'MultiPolygon',
    coordinates: geoJsonCoords,
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
