import { cellToBoundary } from 'h3-js';
import type { LatLon, Polygon } from '../types';

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
 * Convert H3 cell to GeoJSON Polygon
 *
 * @param h3Index - H3 cell ID
 * @returns GeoJSON Polygon geometry
 *
 * @example
 * ```typescript
 * const polygon = h3ToPolygon('892a1072c97ffff');
 * // { type: 'Polygon', coordinates: [[[lon, lat], ...]] }
 * ```
 */
export function h3ToPolygon(h3Index: string): Polygon {
  const boundary = cellToBoundary(h3Index);
  // Convert from [lat, lon] to [lon, lat] for GeoJSON format
  const coordinates = [boundary.map(([lat, lng]) => [lng, lat] as [number, number])];
  return {
    type: 'Polygon',
    coordinates,
  };
}
