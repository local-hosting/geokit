import turfBearing from '@turf/bearing';
import { point as turfPoint } from '@turf/helpers';
import type { LatLon } from '../../types';
import { DEGREES_TO_RADIANS, RADIANS_TO_DEGREES, DEGREES_IN_CIRCLE } from '../../constants';

/**
 * Calculate initial bearing (forward azimuth) between two points
 * Uses Turf.js for robust bearing calculation
 * Returns bearing in degrees from north (0-360)
 *
 * @param point1 - Starting point [lat, lon]
 * @returns Curried function that takes end point and returns bearing in degrees
 *
 * @example
 * ```typescript
 * const fromNYC = bearing([40.7128, -74.0060]);
 * const bearingToLA = fromNYC([34.0522, -118.2437]); // ~270° (west)
 * ```
 */
export function bearing(point1: LatLon) {
  return (point2: LatLon): number => {
    try {
      const [lat1, lon1] = point1;
      const [lat2, lon2] = point2;

      // Convert to Turf format [lon, lat]
      const pt1 = turfPoint([lon1, lat1]);
      const pt2 = turfPoint([lon2, lat2]);

      const bearingDeg = turfBearing(pt1, pt2);

      // Turf returns -180 to 180, normalize to 0-360
      if (typeof bearingDeg === 'number' && !isNaN(bearingDeg)) {
        return (bearingDeg + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE;
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback: custom calculation
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;

    const lat1Rad = lat1 * DEGREES_TO_RADIANS;
    const lat2Rad = lat2 * DEGREES_TO_RADIANS;
    const dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearingRad = Math.atan2(y, x);
    const bearingDeg = bearingRad * RADIANS_TO_DEGREES;

    return (bearingDeg + DEGREES_IN_CIRCLE) % DEGREES_IN_CIRCLE;
  };
}

/**
 * Calculate final bearing (arrival bearing) at destination
 * This is the bearing you'd be traveling when you arrive at the destination
 *
 * @param point1 - Starting point [lat, lon]
 * @returns Curried function that takes end point and returns final bearing in degrees
 *
 * @example
 * ```typescript
 * const fromNYC = finalBearing([40.7128, -74.0060]);
 * const arrivalBearing = fromNYC([34.0522, -118.2437]);
 * ```
 */
export function finalBearing(point1: LatLon) {
  return (point2: LatLon): number => {
    // Final bearing is the reverse of the initial bearing from destination to origin
    const reverseBearing = bearing(point2)(point1);
    return (reverseBearing + 180) % DEGREES_IN_CIRCLE;
  };
}
