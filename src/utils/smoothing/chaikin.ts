/**
 * Chaikin's Corner Cutting Algorithm
 *
 * Smooths polygon/polyline edges by iteratively cutting corners.
 * Each iteration replaces each edge with two new points at 25% and 75% along the edge.
 */

import type { Position } from '../../types';

/**
 * Apply Chaikin's algorithm to smooth a ring (closed polygon boundary)
 *
 * @param ring - Array of [lng, lat] coordinates (first and last should be same for closed ring)
 * @param iterations - Number of smoothing iterations (default: 2, more = smoother)
 * @returns Smoothed ring
 */
export function smoothRing(ring: Position[], iterations: number = 2): Position[] {
  if (ring.length < 4) return ring; // Need at least 3 unique points + closing point

  let result = ring.slice();

  for (let i = 0; i < iterations; i++) {
    result = chaikinIteration(result, true);
  }

  return result;
}

/**
 * Apply Chaikin's algorithm to smooth a polyline (open line)
 *
 * @param line - Array of [lng, lat] coordinates
 * @param iterations - Number of smoothing iterations (default: 2)
 * @returns Smoothed polyline
 */
export function smoothLine(line: Position[], iterations: number = 2): Position[] {
  if (line.length < 3) return line;

  let result = line.slice();

  for (let i = 0; i < iterations; i++) {
    result = chaikinIteration(result, false);
  }

  return result;
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
 * Smooth a GeoJSON Polygon geometry
 */
export function smoothPolygon(polygon: GeoJSON.Polygon, iterations: number = 2): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring) => smoothRing(ring as Position[], iterations)),
  };
}

/**
 * Smooth a GeoJSON MultiPolygon geometry
 */
export function smoothMultiPolygon(
  multiPolygon: GeoJSON.MultiPolygon,
  iterations: number = 2
): GeoJSON.MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: multiPolygon.coordinates.map((polygon) =>
      polygon.map((ring) => smoothRing(ring as Position[], iterations))
    ),
  };
}

/**
 * Smooth any GeoJSON geometry that has polygon-like structures
 */
export function smoothGeometry(
  geometry: GeoJSON.Geometry,
  iterations: number = 2
): GeoJSON.Geometry {
  switch (geometry.type) {
    case 'Polygon':
      return smoothPolygon(geometry, iterations);
    case 'MultiPolygon':
      return smoothMultiPolygon(geometry, iterations);
    case 'LineString':
      return {
        type: 'LineString',
        coordinates: smoothLine(geometry.coordinates as Position[], iterations),
      };
    case 'MultiLineString':
      return {
        type: 'MultiLineString',
        coordinates: geometry.coordinates.map((line) => smoothLine(line as Position[], iterations)),
      };
    default:
      return geometry; // Points, GeometryCollection, etc. - return unchanged
  }
}

/**
 * Smooth all features in a FeatureCollection
 */
export function smoothFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  iterations: number = 2
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((feature) => ({
      ...feature,
      geometry: smoothGeometry(feature.geometry, iterations),
    })),
  };
}
