/**
 * Utility functions for working with Turf.js
 * Provides DRY helpers for common Turf.js operations
 */

import { point as turfPoint, lineString } from '@turf/helpers';
import type { Feature, Point, LatLon, LonLat, Polygon } from './types';

/**
 * Create a Point Feature from a LatLon coordinate
 *
 * @param point - Point in [lat, lon] format
 * @returns Point Feature
 *
 * @example
 * ```typescript
 * const pt = createPoint([40.7128, -74.0060]);
 * ```
 */
export function createPoint(point: LatLon): Feature<Point> {
  const [lat, lon] = point;
  return turfPoint([lon, lat]);
}

/**
 * Create a LineString Feature from two LatLon points
 *
 * @param point1 - First point in [lat, lon] format
 * @param point2 - Second point in [lat, lon] format
 * @returns LineString Feature
 *
 * @example
 * ```typescript
 * const line = createLineString([40.7128, -74.0060], [34.0522, -118.2437]);
 * ```
 */
export function createLineString(point1: LatLon, point2: LatLon) {
  const [lat1, lon1] = point1;
  const [lat2, lon2] = point2;
  return lineString([
    [lon1, lat1],
    [lon2, lat2],
  ]);
}

/**
 * Convert an array of LatLon coordinates to LonLat format
 *
 * @param points - Array of points in [lat, lon] format
 * @returns Array of points in [lon, lat] format
 *
 * @example
 * ```typescript
 * const lonLatCoords = toLonLatArray([
 *   [40.7128, -74.0060],
 *   [34.0522, -118.2437]
 * ]);
 * // [[-74.0060, 40.7128], [-118.2437, 34.0522]]
 * ```
 */
export function toLonLatArray(points: LatLon[]): LonLat[] {
  return points.map(([lat, lon]): LonLat => [lon, lat]);
}

/**
 * Extract LatLon coordinates from a Point Feature
 * Performs type-safe extraction with validation
 *
 * @param feature - Feature with Point geometry
 * @returns Coordinates in [lat, lon] format, or null if invalid
 *
 * @example
 * ```typescript
 * const pt = createPoint([40.7128, -74.0060]);
 * const latLon = extractLatLon(pt);
 * // [40.7128, -74.0060]
 * ```
 */
export function extractLatLon(feature: Feature<Point>): LatLon | null {
  if (
    feature.geometry.type === 'Point' &&
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length >= 2
  ) {
    const [lon, lat] = feature.geometry.coordinates;
    if (typeof lon === 'number' && typeof lat === 'number') {
      return [lat, lon];
    }
  }
  return null;
}

/**
 * Validate that a polygon has a valid structure
 * Checks for outer ring with at least 4 points (closed ring)
 *
 * @param polygon - Polygon to validate
 * @returns true if polygon is valid, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = validatePolygon(polygon);
 * ```
 */
export function validatePolygon(polygon: Polygon): boolean {
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    return false;
  }

  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) {
    return false;
  }

  return true;
}
