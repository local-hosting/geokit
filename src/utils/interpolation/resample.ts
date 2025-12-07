import type { Polyline } from '../../types';
import { interpolateMeters } from './along';
import { EARTH_RADIUS_METERS, DEGREES_TO_RADIANS } from '../../constants';

/**
 * Resample a polyline at regular distance intervals
 * Curried function for functional composition
 *
 * @param interval - Distance between points in meters
 * @returns Function that takes polyline and returns resampled polyline
 *
 * @example
 * ```typescript
 * const polyline = [[40.7000, -74.0100], [40.7100, -74.0000], [40.7200, -73.9900]];
 * const resampled = resample(1000)(polyline); // Point every 1km
 * ```
 */
export function resample(interval: number) {
  return (polyline: Polyline): Polyline => {
    if (polyline.length < 2) {
      return polyline;
    }

    const result: Polyline = [polyline[0]];
    let accumulatedDistance = 0;
    let targetDistance = interval;

    for (let i = 0; i < polyline.length - 1; i++) {
      const start = polyline[i];
      const end = polyline[i + 1];

      // Calculate segment length
      const [lat1, lon1] = start;
      const [lat2, lon2] = end;
      const lat1Rad = lat1 * DEGREES_TO_RADIANS;
      const lat2Rad = lat2 * DEGREES_TO_RADIANS;
      const dLat = (lat2 - lat1) * DEGREES_TO_RADIANS;
      const dLon = (lon2 - lon1) * DEGREES_TO_RADIANS;

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const segmentLength = EARTH_RADIUS_METERS * c;

      // Add points along this segment
      while (accumulatedDistance + segmentLength >= targetDistance) {
        const distanceInSegment = targetDistance - accumulatedDistance;
        const point = interpolateMeters(distanceInSegment)(start)(end);
        result.push(point);
        targetDistance += interval;
      }

      accumulatedDistance += segmentLength;
    }

    // Add the last point if not already added
    const lastPoint = polyline[polyline.length - 1];
    if (
      result.length === 0 ||
      result[result.length - 1][0] !== lastPoint[0] ||
      result[result.length - 1][1] !== lastPoint[1]
    ) {
      result.push(lastPoint);
    }

    return result;
  };
}
