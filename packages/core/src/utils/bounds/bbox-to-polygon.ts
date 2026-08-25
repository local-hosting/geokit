import type { Bounds, LatLon, Polygon } from '../../types';
import { turfBboxPolygon } from '../turf/deps';

/**
 * Convert bounding box to polygon coordinates
 * Uses Turf.js for consistent polygon creation
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @param outputFormat - Output format: 'latlon' for [lat, lon] or 'lonlat' for [lon, lat] (default: 'latlon')
 * @returns Polygon coordinates as array of [lat, lon] or [lon, lat] points
 *
 * @example
 * ```typescript
 * const bounds = [-74.1, 40.6, -73.9, 40.8];
 * const polygon = bboxToPolygon(bounds);
 * // [[40.6, -74.1], [40.6, -73.9], [40.8, -73.9], [40.8, -74.1], [40.6, -74.1]]
 * ```
 */
export function bboxToPolygon(
  bounds: Bounds,
  outputFormat: 'latlon' | 'lonlat' = 'latlon'
): LatLon[] | [number, number][] {
  const [minLon, minLat, maxLon, maxLat] = bounds;

  // Use Turf.js for consistent polygon creation
  const feature = turfBboxPolygon([minLon, minLat, maxLon, maxLat]);
  const coordinates = feature.geometry.coordinates[0]; // Get outer ring

  if (outputFormat === 'latlon') {
    // Convert from [lon, lat] to [lat, lon], ensuring 2-element tuples
    return coordinates.map((coord): LatLon => [coord[1], coord[0]]);
  } else {
    // Return [lon, lat] format (GeoJSON) - ensure 2-element tuples
    return coordinates.map((coord): [number, number] => [coord[0], coord[1]]);
  }
}

/**
 * Convert bounding box to GeoJSON Polygon geometry
 * Uses Turf.js for consistent polygon creation
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns GeoJSON Polygon geometry
 *
 * @example
 * ```typescript
 * const bounds = [-74.1, 40.6, -73.9, 40.8];
 * const polygon = bboxToPolygonGeometry(bounds);
 * // { type: 'Polygon', coordinates: [[[-74.1, 40.6], [-73.9, 40.6], ...]] }
 * ```
 */
export function bboxToPolygonGeometry(bounds: Bounds): Polygon {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  // Use Turf.js for consistent polygon creation
  const feature = turfBboxPolygon([minLon, minLat, maxLon, maxLat]);
  return feature.geometry;
}
