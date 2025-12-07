import type { LatLon, Point } from '../../types';
import { toLonLat } from './conversion';

/**
 * Create a GeoJSON Point from coordinates
 *
 * @param coords - Coordinates in [latitude, longitude] format
 * @returns GeoJSON Point geometry
 *
 * @example
 * ```typescript
 * const point = createPoint([40.7128, -74.0060]);
 * // { type: 'Point', coordinates: [-74.0060, 40.7128] }
 * ```
 */
export function createPoint(coords: LatLon): Point {
  return {
    type: 'Point',
    coordinates: toLonLat(coords),
  };
}
