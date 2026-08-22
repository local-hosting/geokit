import { cellToBoundary } from 'h3-js';
import type { LatLon, Polygon } from '../../types';
import { expandH3CellId } from './cell-id';

type LonLat = [number, number];

/**
 * Keep ring longitudes continuous so map renderers do not draw antimeridian-spanning chords.
 * GeoJSON permits longitude outside [-180, 180] for display.
 */
export function unwrapPolygonRingLongitudes(ring: LonLat[]): LonLat[] {
  if (ring.length === 0) return ring;

  const unwrapped: LonLat[] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prevLng = unwrapped[unwrapped.length - 1][0];
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    unwrapped.push([lng, ring[i][1]]);
  }
  return unwrapped;
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
  const boundary = cellToBoundary(expandH3CellId(h3Index));
  return boundary.map(([lat, lng]) => [lat, lng] as LatLon);
}

/**
 * Convert H3 cell to GeoJSON Polygon
 *
 * @param h3Index - H3 cell ID
 * @returns GeoJSON Polygon geometry, or null if the H3 index is invalid
 *
 * @example
 * ```typescript
 * const polygon = h3ToPolygon('892a1072c97ffff');
 * // { type: 'Polygon', coordinates: [[[lon, lat], ...]] }
 * ```
 */
export function h3ToPolygon(h3Index: string): Polygon | null {
  try {
    const boundary = cellToBoundary(expandH3CellId(h3Index));
    // Convert from [lat, lon] to [lon, lat] for GeoJSON format
    const openRing = boundary.map(([lat, lng]) => [lng, lat] as LonLat);
    const ring = unwrapPolygonRingLongitudes(openRing);
    // Close the ring (GeoJSON requires first and last coordinate to be identical)
    if (ring.length > 0) {
      ring.push([ring[0][0], ring[0][1]]);
    }
    return {
      type: 'Polygon',
      coordinates: [ring],
    };
  } catch {
    return null;
  }
}
