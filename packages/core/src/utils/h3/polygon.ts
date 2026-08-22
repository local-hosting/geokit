import { cellsToMultiPolygon, polygonToCells } from 'h3-js';
import type { Polygon } from '../../types';

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
  // h3-js cellsToMultiPolygon:
  // - Without flag: returns [lat, lng] (H3 native format)
  // - With formatAsGeoJson=true: returns [lng, lat] (GeoJSON format)
  // We need GeoJSON format, so pass true
  // h3-js rejects duplicate cell ids in cellsToMultiPolygon.
  const uniqueIndices = [...new Set(h3Indices)];
  const coords = cellsToMultiPolygon(uniqueIndices, true);

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
  // GeoJSON uses [lng, lat] format
  // h3-js polygonToCells with isGeoJson=true expects [lng, lat] format
  // So we pass the coordinates directly without swapping
  return polygonToCells(polygon.coordinates, resolution, true);
}
