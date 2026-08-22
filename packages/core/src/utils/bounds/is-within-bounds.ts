import type { LatLon, Bounds } from '../../types';

/**
 * Curried function to check if a point is within bounds
 *
 * @param point - Point to check as [latitude, longitude]
 * @param bounds - Bounding box as [minLon, minLat, maxLon, maxLat]
 * @returns true if point is within bounds
 *
 * @example
 * ```typescript
 * const bounds = [-74.0060, 40.7128, -73.9855, 40.7580];
 * const point = [40.7354, -73.99575];
 * const isWithin = isWithinBounds(point)(bounds); // true
 * ```
 */
export function isWithinBounds(point: LatLon) {
  return (bounds: Bounds): boolean => {
    const [lat, lon] = point;
    const [minLon, minLat, maxLon, maxLat] = bounds;

    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  };
}
