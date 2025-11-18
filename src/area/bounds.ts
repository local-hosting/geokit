import type { Bounds } from '../types';

/**
 * Calculate the area of a bounding box in square meters
 * Uses simple rectangular approximation (accurate for small areas)
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
  const [minLon, minLat, maxLon, maxLat] = bounds;

  // Calculate width and height in meters
  const R = 6371000; // Earth's radius in meters

  // Width (longitude difference)
  const avgLat = (minLat + maxLat) / 2;
  const dLon = ((maxLon - minLon) * Math.PI) / 180;
  const width = R * Math.cos((avgLat * Math.PI) / 180) * dLon;

  // Height (latitude difference)
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
