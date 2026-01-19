/**
 * Chaikin's Corner Cutting Algorithm
 *
 * Smooths polygon/polyline edges by iteratively cutting corners.
 * Each iteration replaces each edge with two new points at 25% and 75% along the edge.
 */

import type { Position } from '../../types';

/**
 * Apply Chaikin's algorithm to smooth a ring (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2, more = smoother)
 * @returns Curried function that takes a ring and returns smoothed ring
 *
 * @example
 * ```typescript
 * const smooth3 = smoothRing(3);
 * const smoothed = smooth3(ring);
 *
 * // Or use with map
 * const smoothedRings = rings.map(smoothRing(2));
 * ```
 */
export function smoothRing(iterations: number = 2) {
  return (ring: Position[]): Position[] => {
    if (ring.length < 4) return ring; // Need at least 3 unique points + closing point

    let result = ring.slice();

    for (let i = 0; i < iterations; i++) {
      result = chaikinIteration(result, true);
    }

    return result;
  };
}

/**
 * Apply Chaikin's algorithm to smooth a polyline (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Curried function that takes a line and returns smoothed polyline
 *
 * @example
 * ```typescript
 * const smooth3 = smoothLine(3);
 * const smoothed = smooth3(line);
 *
 * // Or use with map
 * const smoothedLines = lines.map(smoothLine(2));
 * ```
 */
export function smoothLine(iterations: number = 2) {
  return (line: Position[]): Position[] => {
    if (line.length < 3) return line;

    let result = line.slice();

    for (let i = 0; i < iterations; i++) {
      result = chaikinIteration(result, false);
    }

    return result;
  };
}

/**
 * Single iteration of Chaikin's algorithm
 */
function chaikinIteration(points: Position[], isClosed: boolean): Position[] {
  if (points.length < 3) return points;

  const result: Position[] = [];
  const len = isClosed ? points.length - 1 : points.length; // Exclude closing point for closed rings

  // For open lines, keep the first point
  if (!isClosed) {
    result.push(points[0]);
  }

  for (let i = 0; i < len - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];

    // Q = 0.75 * P[i] + 0.25 * P[i+1]
    const q: Position = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];

    // R = 0.25 * P[i] + 0.75 * P[i+1]
    const r: Position = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];

    result.push(q, r);
  }

  // For closed rings, connect back to start
  if (isClosed) {
    // Add points between last and first
    const pLast = points[len - 1];
    const pFirst = points[0];

    const q: Position = [0.75 * pLast[0] + 0.25 * pFirst[0], 0.75 * pLast[1] + 0.25 * pFirst[1]];

    const r: Position = [0.25 * pLast[0] + 0.75 * pFirst[0], 0.25 * pLast[1] + 0.75 * pFirst[1]];

    result.push(q, r);

    // Close the ring
    result.push(result[0]);
  } else {
    // For open lines, keep the last point
    result.push(points[points.length - 1]);
  }

  return result;
}

/**
 * Smooth a GeoJSON Polygon geometry (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Curried function that takes a polygon and returns smoothed polygon
 */
export function smoothPolygon(iterations: number = 2) {
  return (polygon: GeoJSON.Polygon): GeoJSON.Polygon => {
    return {
      type: 'Polygon',
      coordinates: polygon.coordinates.map((ring) => smoothRing(iterations)(ring as Position[])),
    };
  };
}

/**
 * Smooth a GeoJSON MultiPolygon geometry (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Curried function that takes a multipolygon and returns smoothed multipolygon
 */
export function smoothMultiPolygon(iterations: number = 2) {
  return (multiPolygon: GeoJSON.MultiPolygon): GeoJSON.MultiPolygon => {
    return {
      type: 'MultiPolygon',
      coordinates: multiPolygon.coordinates.map((polygon) =>
        polygon.map((ring) => smoothRing(iterations)(ring as Position[]))
      ),
    };
  };
}

/**
 * Smooth any GeoJSON geometry that has polygon-like structures (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Curried function that takes a geometry and returns smoothed geometry
 *
 * @example
 * ```typescript
 * const smooth3 = smoothGeometry(3);
 * const smoothed = smooth3(geometry);
 *
 * // Or use with map
 * const smoothedGeometries = geometries.map(smoothGeometry(2));
 * ```
 */
export function smoothGeometry(iterations: number = 2) {
  return (geometry: GeoJSON.Geometry): GeoJSON.Geometry => {
    switch (geometry.type) {
      case 'Polygon':
        return smoothPolygon(iterations)(geometry);
      case 'MultiPolygon':
        return smoothMultiPolygon(iterations)(geometry);
      case 'LineString':
        return {
          type: 'LineString',
          coordinates: smoothLine(iterations)(geometry.coordinates as Position[]),
        };
      case 'MultiLineString':
        return {
          type: 'MultiLineString',
          coordinates: geometry.coordinates.map((line) =>
            smoothLine(iterations)(line as Position[])
          ),
        };
      default:
        return geometry; // Points, GeometryCollection, etc. - return unchanged
    }
  };
}

/**
 * Smooth all features in a FeatureCollection (curried)
 *
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Curried function that takes a feature collection and returns smoothed collection
 *
 * @example
 * ```typescript
 * const smooth3 = smoothFeatureCollection(3);
 * const smoothed = smooth3(featureCollection);
 * ```
 */
export function smoothFeatureCollection(iterations: number = 2) {
  return (fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection => {
    return {
      type: 'FeatureCollection',
      features: fc.features.map((feature) => ({
        ...feature,
        geometry: smoothGeometry(iterations)(feature.geometry),
      })),
    };
  };
}
