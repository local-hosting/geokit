import simplifyTurf from '@turf/simplify';
import { polygon as turfPolygon } from '@turf/helpers';
import type { LatLon } from '../types';
import { toLonLatArray, toLatLonArray } from '../coordinates/conversion';
import { METERS_PER_DEGREE_EQUATOR, DEGREES_TO_RADIANS } from '../constants';

/**
 * Simplify a polygon ring using the Douglas-Peucker algorithm via Turf.js
 * Handles closed rings by temporarily removing the closing point, simplifying, then re-closing
 * Reduces the number of points while preserving the general shape
 *
 * @param tolerance - Maximum distance a point can be from the simplified line (in degrees)
 * @returns Function that takes polygon ring and returns simplified ring
 *
 * @example
 * ```typescript
 * const ring = [[40.6, -74.1], [40.6, -73.9], [40.8, -73.9], [40.8, -74.1], [40.6, -74.1]];
 * const simplified = simplifyPolygonRing(0.01)(ring);
 * ```
 */
export function simplifyPolygonRing(tolerance: number) {
  return (ring: LatLon[]): LatLon[] => {
    if (ring.length <= 3) {
      return ring; // Need at least 3 points for a valid polygon (including closing point)
    }

    // Check if ring is closed (first and last points are the same)
    const isClosed =
      ring.length > 0 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1];

    // Remove closing point for simplification (Turf expects open rings)
    const openRing = isClosed ? ring.slice(0, -1) : ring;

    if (openRing.length <= 2) {
      return ring; // Too few points to simplify
    }

    try {
      // Convert from [lat, lon] to [lon, lat] for Turf
      const coords = toLonLatArray(openRing);

      // Create a closed polygon for Turf (it will handle the closing)
      const poly = turfPolygon([coords]);

      const simplified = simplifyTurf(poly, {
        tolerance,
        highQuality: true,
      });

      // Extract the simplified ring
      if (
        simplified.geometry.type === 'Polygon' &&
        simplified.geometry.coordinates[0] &&
        Array.isArray(simplified.geometry.coordinates[0])
      ) {
        const simplifiedRing = simplified.geometry.coordinates[0];

        // Convert back from [lon, lat] to [lat, lon]
        const result = toLatLonArray(simplifiedRing);

        // Re-close the ring if it was originally closed
        if (isClosed && result.length > 0) {
          const first = result[0];
          const last = result[result.length - 1];

          // Only add closing point if it's not already closed
          if (first[0] !== last[0] || first[1] !== last[1]) {
            result.push([first[0], first[1]]);
          }
        }

        return result;
      }
    } catch {
      // Fall through to return original
    }

    return ring;
  };
}

/**
 * Simplify a polygon ring with tolerance in meters
 * Converts tolerance to approximate degrees based on latitude
 *
 * @param toleranceMeters - Maximum distance in meters
 * @returns Function that takes polygon ring and returns simplified ring
 *
 * @example
 * ```typescript
 * const ring = [[40.6, -74.1], [40.6, -73.9], [40.8, -73.9], [40.8, -74.1], [40.6, -74.1]];
 * const simplified = simplifyPolygonRingMeters(100)(ring); // 100m tolerance
 * ```
 */
export function simplifyPolygonRingMeters(toleranceMeters: number) {
  return (ring: LatLon[]): LatLon[] => {
    if (ring.length === 0) {
      return ring;
    }

    // Use average latitude to convert meters to degrees
    const avgLat = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const metersPerDegree = METERS_PER_DEGREE_EQUATOR * Math.cos(avgLat * DEGREES_TO_RADIANS);
    const toleranceDegrees = toleranceMeters / metersPerDegree;

    return simplifyPolygonRing(toleranceDegrees)(ring);
  };
}

/**
 * Simplify a polygon ring to a maximum number of points
 * Uses Douglas-Peucker with adaptive tolerance to achieve target point count
 * This provides better shape preservation than simple decimation
 *
 * @param maxPoints - Maximum number of points in the simplified ring
 * @returns Function that takes polygon ring and returns simplified ring
 *
 * @example
 * ```typescript
 * const ring = [[40.6, -74.1], [40.6, -73.9], [40.8, -73.9], [40.8, -74.1], [40.6, -74.1]];
 * const simplified = simplifyPolygonRingToMaxPoints(100)(ring);
 * ```
 */
export function simplifyPolygonRingToMaxPoints(maxPoints: number) {
  return (ring: LatLon[]): LatLon[] => {
    if (!ring || ring.length <= maxPoints) {
      return ring;
    }

    // Check if ring is closed
    const isClosed =
      ring.length > 0 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1];
    const openRingLength = isClosed ? ring.length - 1 : ring.length;

    if (openRingLength <= maxPoints) {
      return ring;
    }

    // Binary search for tolerance that gives us approximately maxPoints
    // Start with a reasonable tolerance range
    let minTolerance = 0.0001;
    let maxTolerance = 1.0;
    let bestResult = ring;

    // Try progressively larger tolerances until we get close to maxPoints
    for (let i = 0; i < 20; i++) {
      const tolerance = (minTolerance + maxTolerance) / 2;
      const simplified = simplifyPolygonRing(tolerance)(ring);
      const simplifiedLength = isClosed ? simplified.length - 1 : simplified.length;

      if (simplifiedLength <= maxPoints) {
        bestResult = simplified;
        minTolerance = tolerance;
      } else {
        maxTolerance = tolerance;
      }

      // If we're close enough, break early
      if (Math.abs(simplifiedLength - maxPoints) <= 2) {
        break;
      }
    }

    return bestResult;
  };
}
