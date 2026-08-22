import type { LatLon, Bounds } from '../../types';

/**
 * Check if a point is within bounding box
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Curried function that takes point and returns true if inside bounds
 *
 * @example
 * ```typescript
 * const checkBounds = boundsContains([-74.1, 40.6, -73.9, 40.8]);
 * const isInside = checkBounds([40.7128, -74.0060]); // true or false
 * ```
 */
export function boundsContains(bounds: Bounds) {
  return (point: LatLon): boolean => {
    const [lat, lon] = point;
    const [minLon, minLat, maxLon, maxLat] = bounds;

    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  };
}

/**
 * Check if one bounding box contains another
 *
 * @param outerBounds - Outer bounding box
 * @returns Curried function that takes inner bounds and returns true if contained
 *
 * @example
 * ```typescript
 * const checkOuter = boundsContainsBounds([-75, 40, -73, 41]);
 * const contains = checkOuter([-74.1, 40.6, -73.9, 40.8]); // true
 * ```
 */
export function boundsContainsBounds(outerBounds: Bounds) {
  return (innerBounds: Bounds): boolean => {
    const [outerMinLon, outerMinLat, outerMaxLon, outerMaxLat] = outerBounds;
    const [innerMinLon, innerMinLat, innerMaxLon, innerMaxLat] = innerBounds;

    return (
      innerMinLon >= outerMinLon &&
      innerMaxLon <= outerMaxLon &&
      innerMinLat >= outerMinLat &&
      innerMaxLat <= outerMaxLat
    );
  };
}

/**
 * Check if two bounding boxes intersect
 *
 * @param bounds1 - First bounding box
 * @returns Curried function that takes second bounds and returns true if they intersect
 *
 * @example
 * ```typescript
 * const checkIntersect = boundsIntersects([-74.1, 40.6, -73.9, 40.8]);
 * const intersects = checkIntersect([-74.0, 40.7, -73.8, 40.9]); // true
 * ```
 */
export function boundsIntersects(bounds1: Bounds) {
  return (bounds2: Bounds): boolean => {
    const [minLon1, minLat1, maxLon1, maxLat1] = bounds1;
    const [minLon2, minLat2, maxLon2, maxLat2] = bounds2;

    return !(maxLon1 < minLon2 || minLon1 > maxLon2 || maxLat1 < minLat2 || minLat1 > maxLat2);
  };
}
