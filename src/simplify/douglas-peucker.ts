import type { LatLon } from '../types';

/**
 * Simplify a polyline using the Douglas-Peucker algorithm
 * Reduces the number of points while preserving the general shape
 *
 * @param tolerance - Maximum distance a point can be from the simplified line (in degrees)
 * @param polyline - Array of points forming a polyline
 * @returns Simplified polyline
 *
 * @example
 * ```typescript
 * const polyline = [[40.7, -74.0], [40.71, -74.01], [40.72, -74.02], [40.73, -74.03]];
 * const simplified = simplify(0.01, polyline);
 * ```
 */
export function simplify(tolerance: number, polyline: LatLon[]): LatLon[] {
  if (polyline.length <= 2) {
    return polyline;
  }

  const sqTolerance = tolerance * tolerance;

  // Helper: squared distance from point to segment
  function getSquareSegmentDistance(
    point: LatLon,
    segmentStart: LatLon,
    segmentEnd: LatLon
  ): number {
    let [x, y] = segmentStart;
    const [px, py] = point;
    const [x2, y2] = segmentEnd;

    let dx = x2 - x;
    let dy = y2 - y;

    if (dx !== 0 || dy !== 0) {
      const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);

      if (t > 1) {
        x = x2;
        y = y2;
      } else if (t > 0) {
        x += dx * t;
        y += dy * t;
      }
    }

    dx = px - x;
    dy = py - y;

    return dx * dx + dy * dy;
  }

  // Douglas-Peucker algorithm
  function douglasPeucker(points: LatLon[], first: number, last: number, sqTol: number): LatLon[] {
    let maxSqDist = sqTol;
    let index = 0;

    const firstPoint = points[first];
    const lastPoint = points[last];

    for (let i = first + 1; i < last; i++) {
      const sqDist = getSquareSegmentDistance(points[i], firstPoint, lastPoint);

      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }

    if (maxSqDist > sqTol) {
      if (index - first > 1) {
        const left = douglasPeucker(points, first, index, sqTol);
        const right = douglasPeucker(points, index, last, sqTol);
        return left.slice(0, -1).concat(right);
      } else {
        return [firstPoint, lastPoint];
      }
    } else {
      return [firstPoint, lastPoint];
    }
  }

  return douglasPeucker(polyline, 0, polyline.length - 1, sqTolerance);
}

/**
 * Simplify a polyline with tolerance in meters
 * Converts tolerance to approximate degrees based on latitude
 *
 * @param toleranceMeters - Maximum distance in meters
 * @param polyline - Array of points forming a polyline
 * @returns Simplified polyline
 *
 * @example
 * ```typescript
 * const polyline = [[40.7, -74.0], [40.71, -74.01], [40.72, -74.02]];
 * const simplified = simplifyMeters(100, polyline); // 100m tolerance
 * ```
 */
export function simplifyMeters(toleranceMeters: number, polyline: LatLon[]): LatLon[] {
  if (polyline.length === 0) {
    return polyline;
  }

  // Use average latitude to convert meters to degrees
  const avgLat = polyline.reduce((sum, point) => sum + point[0], 0) / polyline.length;
  const metersPerDegree = 111320 * Math.cos((avgLat * Math.PI) / 180);
  const toleranceDegrees = toleranceMeters / metersPerDegree;

  return simplify(toleranceDegrees, polyline);
}
