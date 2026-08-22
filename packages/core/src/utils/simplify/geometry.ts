import simplifyTurf from '@turf/simplify';
import type { Polygon, MultiPolygon } from '../../types';

/**
 * Simplify a Polygon or MultiPolygon geometry using Douglas-Peucker algorithm via Turf.js
 * Works on full GeoJSON geometries (not just coordinate arrays)
 *
 * @param tolerance - Maximum distance a point can be from the simplified line (in degrees)
 * @returns Function that takes geometry and returns simplified geometry
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]]
 * };
 * const simplified = simplifyGeometry(0.01)(polygon);
 * ```
 */
export function simplifyGeometry(tolerance: number) {
  return (geometry: Polygon | MultiPolygon): Polygon | MultiPolygon => {
    if (!geometry || !geometry.coordinates) {
      return geometry;
    }

    try {
      const simplified = simplifyTurf(geometry, {
        tolerance,
        highQuality: true,
      });

      // Ensure we return the same type
      if (
        (geometry.type === 'Polygon' && simplified.type === 'Polygon') ||
        (geometry.type === 'MultiPolygon' && simplified.type === 'MultiPolygon')
      ) {
        return simplified;
      }
    } catch {
      // Fall through to return original
    }

    return geometry;
  };
}

/**
 * Simplify a geometry with tolerance in meters
 * Converts tolerance to approximate degrees based on geometry's latitude
 *
 * @param toleranceMeters - Maximum distance in meters
 * @returns Function that takes geometry and returns simplified geometry
 *
 * @example
 * ```typescript
 * const polygon = { type: 'Polygon', coordinates: [...] };
 * const simplified = simplifyGeometryMeters(100)(polygon); // 100m tolerance
 * ```
 */
export function simplifyGeometryMeters(toleranceMeters: number) {
  return (geometry: Polygon | MultiPolygon): Polygon | MultiPolygon => {
    if (!geometry || !geometry.coordinates) {
      return geometry;
    }

    // Estimate average latitude from geometry bounds
    // For simplicity, use a reasonable default if we can't calculate
    let avgLat = 40; // Default to mid-latitudes

    if (geometry.type === 'Polygon' && geometry.coordinates[0]) {
      const coords = geometry.coordinates[0];
      if (coords.length > 0) {
        // Calculate average latitude from first ring
        const lats = coords
          .map((coord) => (Array.isArray(coord) && coord.length >= 2 ? coord[1] : null))
          .filter((lat): lat is number => typeof lat === 'number' && !isNaN(lat));
        if (lats.length > 0) {
          avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
        }
      }
    } else if (geometry.type === 'MultiPolygon' && geometry.coordinates[0]?.[0]) {
      const coords = geometry.coordinates[0][0];
      if (coords.length > 0) {
        const lats = coords
          .map((coord) => (Array.isArray(coord) && coord.length >= 2 ? coord[1] : null))
          .filter((lat): lat is number => typeof lat === 'number' && !isNaN(lat));
        if (lats.length > 0) {
          avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
        }
      }
    }

    // Convert meters to degrees
    const METERS_PER_DEGREE_EQUATOR = 111320;
    const DEGREES_TO_RADIANS = Math.PI / 180;
    const metersPerDegree = METERS_PER_DEGREE_EQUATOR * Math.cos(avgLat * DEGREES_TO_RADIANS);
    const toleranceDegrees = toleranceMeters / metersPerDegree;

    return simplifyGeometry(toleranceDegrees)(geometry);
  };
}
