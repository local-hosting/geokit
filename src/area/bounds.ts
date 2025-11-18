import turfBboxPolygon from '@turf/bbox-polygon';
import turfArea from '@turf/area';
import type { Bounds } from '../types';

/**
 * Calculate the area of a bounding box in square meters
 * Uses Turf.js for robust area calculation
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Area in square meters
 *
 * @example
 * ```typescript
 * const bounds = [-74.1, 40.6, -73.9, 40.8];
 * const area = boundsArea(bounds); // Area in square meters
 * ```
 */
export function boundsArea(bounds: Bounds): number {
  try {
    const [minLon, minLat, maxLon, maxLat] = bounds;

    // Validate bounds
    if (
      typeof minLon !== 'number' ||
      typeof minLat !== 'number' ||
      typeof maxLon !== 'number' ||
      typeof maxLat !== 'number' ||
      isNaN(minLon) ||
      isNaN(minLat) ||
      isNaN(maxLon) ||
      isNaN(maxLat)
    ) {
      return 0;
    }

    // Convert bounds to polygon using Turf
    const polygon = turfBboxPolygon([minLon, minLat, maxLon, maxLat]);
    const area = turfArea(polygon);

    // Validate result
    if (typeof area === 'number' && !isNaN(area) && isFinite(area) && area >= 0) {
      return area;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: simple rectangular approximation
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const R = 6371000; // Earth's radius in meters
  const avgLat = (minLat + maxLat) / 2;
  const dLon = ((maxLon - minLon) * Math.PI) / 180;
  const width = R * Math.cos((avgLat * Math.PI) / 180) * dLon;
  const dLat = ((maxLat - minLat) * Math.PI) / 180;
  const height = R * dLat;
  return Math.abs(width * height);
}

/**
 * Calculate the area of a bounding box in square kilometers
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Area in square kilometers
 */
export function boundsAreaKm(bounds: Bounds): number {
  return boundsArea(bounds) / 1000000;
}

/**
 * Calculate the area of a bounding box in square miles
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Area in square miles
 */
export function boundsAreaMiles(bounds: Bounds): number {
  return boundsArea(bounds) / 2589988.110336;
}
