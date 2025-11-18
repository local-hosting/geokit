import type { LatLon } from '../types';
import { interpolateMeters } from './along';

/**
 * Resample a polyline at regular distance intervals
 *
 * @param interval - Distance between points in meters
 * @param polyline - Array of points forming a polyline
 * @returns Resampled polyline with points at regular intervals
 *
 * @example
 * ```typescript
 * const polyline = [[40.7000, -74.0100], [40.7100, -74.0000], [40.7200, -73.9900]];
 * const resampled = resample(1000, polyline); // Point every 1km
 * ```
 */
export function resample(interval: number, polyline: LatLon[]): LatLon[] {
  if (polyline.length < 2) {
    return polyline;
  }

  const result: LatLon[] = [polyline[0]];
  let accumulatedDistance = 0;
  let targetDistance = interval;

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];

    // Calculate segment length
    const [lat1, lon1] = start;
    const [lat2, lon2] = end;
    const R = 6371000;
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const segmentLength = R * c;

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
}
