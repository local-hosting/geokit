/**
 * Calculate the perimeter of a polygon
 */

import type { Polygon } from '../types';
import { lineLengthMeters } from './line';

/**
 * Calculate the perimeter of a polygon in meters
 * Calculates the length of the outer ring
 *
 * @param polygon - Polygon to calculate perimeter for
 * @returns Perimeter in meters
 *
 * @example
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [
 *     [
 *       [-74.01, 40.7],
 *       [-74.0, 40.7],
 *       [-74.0, 40.71],
 *       [-74.01, 40.71],
 *       [-74.01, 40.7]
 *     ]
 *   ]
 * };
 * const perimeter = perimeterMeters(polygon);
 */
export function perimeterMeters(polygon: Polygon): number {
  if (!polygon.coordinates || polygon.coordinates.length === 0) {
    return 0;
  }

  // Convert outer ring from [lon, lat] to [lat, lon]
  const ring = polygon.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);

  return lineLengthMeters(ring);
}

/**
 * Calculate the perimeter of a polygon
 * Higher-order function for custom distance calculations
 *
 * @param distanceFn - Distance function to use
 * @returns Function that takes a polygon and returns its perimeter
 */
export function perimeter(
  distanceFn: (point1: [number, number]) => (point2: [number, number]) => number
): (polygon: Polygon) => number {
  return (polygon: Polygon): number => {
    if (!polygon.coordinates || polygon.coordinates.length === 0) {
      return 0;
    }

    const ring = polygon.coordinates[0];
    let totalLength = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      const distance = distanceFn([lat1, lon1])([lat2, lon2]);
      totalLength += distance;
    }

    return totalLength;
  };
}

/**
 * Calculate the perimeter of a polygon in kilometers
 *
 * @param polygon - Polygon to calculate perimeter for
 * @returns Perimeter in kilometers
 */
export function perimeterKm(polygon: Polygon): number {
  return perimeterMeters(polygon) / 1000;
}

/**
 * Calculate the perimeter of a polygon in miles
 *
 * @param polygon - Polygon to calculate perimeter for
 * @returns Perimeter in miles
 */
export function perimeterMiles(polygon: Polygon): number {
  return perimeterMeters(polygon) / 1609.34;
}
