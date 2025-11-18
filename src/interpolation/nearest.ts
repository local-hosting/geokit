import type { LatLon } from '../types';

/**
 * Find the nearest point on a line segment to a given point
 *
 * @param point - Point to find nearest point for
 * @returns Curried function that takes line endpoints and returns nearest point
 *
 * @example
 * ```typescript
 * const findNearest = nearestPointOnLine([40.7128, -74.0060]);
 * const lineStart = [40.7000, -74.0100];
 * const lineEnd = [40.7200, -73.9900];
 * const nearest = findNearest(lineStart)(lineEnd);
 * ```
 */
export function nearestPointOnLine(point: LatLon) {
  return (lineStart: LatLon) => {
    return (lineEnd: LatLon): LatLon => {
      const [px, py] = point;
      const [x1, y1] = lineStart;
      const [x2, y2] = lineEnd;

      const dx = x2 - x1;
      const dy = y2 - y1;

      if (dx === 0 && dy === 0) {
        // Line start and end are the same point
        return lineStart;
      }

      // Calculate the parameter t that represents the projection of point p onto the line
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));

      // Calculate the nearest point
      const nearestX = x1 + t * dx;
      const nearestY = y1 + t * dy;

      return [nearestX, nearestY];
    };
  };
}

/**
 * Find the nearest point on a polyline to a given point
 *
 * @param point - Point to find nearest point for
 * @param polyline - Array of points forming a polyline
 * @returns Object with nearest point and segment index
 *
 * @example
 * ```typescript
 * const point = [40.7128, -74.0060];
 * const polyline = [[40.7000, -74.0100], [40.7100, -74.0000], [40.7200, -73.9900]];
 * const result = nearestPointOnPolyline(point, polyline);
 * // { point: [lat, lon], segmentIndex: 0, distance: 123.45 }
 * ```
 */
export function nearestPointOnPolyline(
  point: LatLon,
  polyline: LatLon[]
): { point: LatLon; segmentIndex: number; distance: number } | null {
  if (polyline.length < 2) {
    return null;
  }

  let nearestPoint: LatLon | null = null;
  let minDistance = Infinity;
  let nearestSegmentIndex = -1;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];
    const nearest = nearestPointOnLine(point)(segmentStart)(segmentEnd);

    // Calculate distance using simple Euclidean (good enough for finding nearest)
    const [px, py] = point;
    const [nx, ny] = nearest;
    const distance = Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = nearest;
      nearestSegmentIndex = i;
    }
  }

  return nearestPoint
    ? {
        point: nearestPoint,
        segmentIndex: nearestSegmentIndex,
        distance: minDistance,
      }
    : null;
}
