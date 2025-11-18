import simplifyTurf from '@turf/simplify';
import { lineString } from '@turf/helpers';
import type { LatLon } from '../types';
import { METERS_PER_DEGREE_EQUATOR, DEGREES_TO_RADIANS } from '../constants';

/**
 * Simplify a polyline using the Douglas-Peucker algorithm via Turf.js
 * Reduces the number of points while preserving the general shape
 * Curried function for functional composition
 *
 * @param tolerance - Maximum distance a point can be from the simplified line (in degrees)
 * @returns Function that takes polyline and returns simplified polyline
 *
 * @example
 * ```typescript
 * const polyline = [[40.7, -74.0], [40.71, -74.01], [40.72, -74.02], [40.73, -74.03]];
 * const simplified = simplify(0.01)(polyline);
 * ```
 */
export function simplify(tolerance: number) {
  return (polyline: LatLon[]): LatLon[] => {
    if (polyline.length <= 2) {
      return polyline;
    }

    try {
      // Convert from [lat, lon] to [lon, lat] for Turf
      const coords = polyline.map(([lat, lon]) => [lon, lat]);
      const line = lineString(coords);

      const simplified = simplifyTurf(line, {
        tolerance,
        highQuality: true,
      });

      // Type-safe extraction and convert back from [lon, lat] to [lat, lon]
      if (
        simplified.geometry.type === 'LineString' &&
        Array.isArray(simplified.geometry.coordinates)
      ) {
        return simplified.geometry.coordinates.map((coord): LatLon => {
          if (Array.isArray(coord) && coord.length >= 2) {
            const [lon, lat] = coord;
            if (typeof lon === 'number' && typeof lat === 'number') {
              return [lat, lon];
            }
          }
          // Fallback (shouldn't happen with valid Turf output)
          return [0, 0];
        });
      }
    } catch {
      // Fall through to return original
    }

    return polyline;
  };
}

/**
 * Simplify a polyline with tolerance in meters
 * Converts tolerance to approximate degrees based on latitude
 * Curried function for functional composition
 *
 * @param toleranceMeters - Maximum distance in meters
 * @returns Function that takes polyline and returns simplified polyline
 *
 * @example
 * ```typescript
 * const polyline = [[40.7, -74.0], [40.71, -74.01], [40.72, -74.02]];
 * const simplified = simplifyMeters(100)(polyline); // 100m tolerance
 * ```
 */
export function simplifyMeters(toleranceMeters: number) {
  return (polyline: LatLon[]): LatLon[] => {
    if (polyline.length === 0) {
      return polyline;
    }

    // Use average latitude to convert meters to degrees
    const avgLat = polyline.reduce((sum, point) => sum + point[0], 0) / polyline.length;
    const metersPerDegree = METERS_PER_DEGREE_EQUATOR * Math.cos(avgLat * DEGREES_TO_RADIANS);
    const toleranceDegrees = toleranceMeters / metersPerDegree;

    return simplify(toleranceDegrees)(polyline);
  };
}
