import turfAlong from '@turf/along';
import { lineString } from '@turf/helpers';
import type { LatLon } from '../types';
import { haversineMeters } from '../distance';
import { METERS_TO_KILOMETERS } from '../constants';

/**
 * Interpolate a point at a given fraction along the path between two points
 * Uses Turf.js for robust interpolation
 *
 * @param fraction - Fraction along path (0 = start, 1 = end, 0.5 = midpoint)
 * @returns Curried function that takes two points and returns interpolated point
 *
 * @example
 * ```typescript
 * const halfway = interpolate(0.5);
 * const midPoint = halfway([40.7128, -74.0060])([34.0522, -118.2437]);
 * ```
 */
export function interpolate(fraction: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): LatLon => {
      try {
        const [lat1, lon1] = point1;
        const [lat2, lon2] = point2;

        // Convert to Turf format [lon, lat]
        const line = lineString([
          [lon1, lat1],
          [lon2, lat2],
        ]);

        // Calculate total distance
        const totalDistance = haversineMeters(point1)(point2);
        const distanceAtFraction = totalDistance * Math.max(0, Math.min(1, fraction));

        // Use Turf's along function
        const interpolated = turfAlong(line, distanceAtFraction / METERS_TO_KILOMETERS, {
          units: 'kilometers',
        });

        // Type-safe extraction
        if (
          interpolated.geometry.type === 'Point' &&
          Array.isArray(interpolated.geometry.coordinates) &&
          interpolated.geometry.coordinates.length >= 2
        ) {
          const [lon, lat] = interpolated.geometry.coordinates;
          if (typeof lon === 'number' && typeof lat === 'number') {
            return [lat, lon];
          }
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback: simple linear interpolation (less accurate)
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;
      const clampedFraction = Math.max(0, Math.min(1, fraction));
      return [lat1 + (lat2 - lat1) * clampedFraction, lon1 + (lon2 - lon1) * clampedFraction];
    };
  };
}

/**
 * Interpolate a point at a given distance along the path between two points
 * Uses Turf.js for robust distance-based interpolation
 *
 * @param distance - Distance in meters from start point
 * @returns Curried function that takes two points and returns interpolated point
 *
 * @example
 * ```typescript
 * const at1km = interpolateMeters(1000);
 * const pointAt1km = at1km([40.7128, -74.0060])([40.7580, -73.9855]);
 * ```
 */
export function interpolateMeters(distance: number) {
  return (point1: LatLon) => {
    return (point2: LatLon): LatLon => {
      try {
        const [lat1, lon1] = point1;
        const [lat2, lon2] = point2;

        // Convert to Turf format [lon, lat]
        const line = lineString([
          [lon1, lat1],
          [lon2, lat2],
        ]);

        // Use Turf's along function with distance in kilometers
        const interpolated = turfAlong(line, distance / METERS_TO_KILOMETERS, {
          units: 'kilometers',
        });

        // Type-safe extraction
        if (
          interpolated.geometry.type === 'Point' &&
          Array.isArray(interpolated.geometry.coordinates) &&
          interpolated.geometry.coordinates.length >= 2
        ) {
          const [lon, lat] = interpolated.geometry.coordinates;
          if (typeof lon === 'number' && typeof lat === 'number') {
            return [lat, lon];
          }
        }
      } catch {
        // Fall through to fallback
      }

      // Fallback: calculate fraction and use interpolate
      const totalDistance = haversineMeters(point1)(point2);
      const fraction = totalDistance > 0 ? Math.min(1, Math.max(0, distance / totalDistance)) : 0;
      return interpolate(fraction)(point1)(point2);
    };
  };
}
