import nearestPointOnLineTurf from '@turf/nearest-point-on-line';
import { lineString } from '@turf/helpers';
import type { LatLon, Polyline } from '../types';
import { haversineMeters } from '../distance';
import { createPoint, createLineString, toLonLatArray, extractLatLon } from '../turf-utils';

/**
 * Find the nearest point on a line segment to a given point
 * Uses Turf.js for robust nearest point calculation
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
      try {
        const pt = createPoint(point);
        const line = createLineString(lineStart, lineEnd);

        const nearest = nearestPointOnLineTurf(line, pt);

        const result = extractLatLon(nearest);
        if (result) {
          return result;
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback to simple implementation
      const [px, py] = point;
      const [x1, y1] = lineStart;
      const [x2, y2] = lineEnd;

      const dx = x2 - x1;
      const dy = y2 - y1;

      if (dx === 0 && dy === 0) {
        return lineStart;
      }

      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
      return [x1 + t * dx, y1 + t * dy];
    };
  };
}

/**
 * Find the nearest point on a polyline to a given point
 * Uses Turf.js for robust nearest point calculation
 * Curried function for functional composition
 *
 * @param point - Point to find nearest point for
 * @returns Function that takes polyline and returns object with nearest point and segment index
 *
 * @example
 * ```typescript
 * const point = [40.7128, -74.0060];
 * const polyline = [[40.7000, -74.0100], [40.7100, -74.0000], [40.7200, -73.9900]];
 * const result = nearestPointOnPolyline(point)(polyline);
 * // { point: [lat, lon], segmentIndex: 0, distance: 123.45 }
 * ```
 */
export function nearestPointOnPolyline(point: LatLon) {
  return (polyline: Polyline): { point: LatLon; segmentIndex: number; distance: number } | null => {
    if (polyline.length < 2) {
      return null;
    }

    try {
      const coords = toLonLatArray(polyline);
      const pt = createPoint(point);
      const line = lineString(coords);

      const nearest = nearestPointOnLineTurf(line, pt);

      const nearestPoint = extractLatLon(nearest);
      if (nearestPoint) {
        // Calculate distance using haversine for accuracy
        const distance = haversineMeters(point)(nearestPoint);

        // Get segment index from Turf properties
        const index = typeof nearest.properties?.index === 'number' ? nearest.properties.index : 0;

        return {
          point: nearestPoint,
          distance,
          segmentIndex: index,
        };
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback to manual calculation
    let nearestPoint: LatLon | null = null;
    let minDistance = Infinity;
    let nearestSegmentIndex = -1;

    for (let i = 0; i < polyline.length - 1; i++) {
      const segmentStart = polyline[i];
      const segmentEnd = polyline[i + 1];
      const nearest = nearestPointOnLine(point)(segmentStart)(segmentEnd);

      // Calculate distance using haversine for accuracy
      const distance = haversineMeters(point)(nearest);

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
  };
}
