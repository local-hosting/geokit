

import type { Polygon } from '../../types';
import { turfArea, turfPolygon } from '../turf/deps';
import {
  SQUARE_METERS_TO_SQUARE_KILOMETERS,
  SQUARE_METERS_TO_SQUARE_MILES,
  SQUARE_METERS_TO_ACRES,
} from '../../constants';

/**
 * Calculate the area of a polygon in square meters
 * Uses Turf.js for robust area calculation on Earth's surface
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in square meters
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]]
 * };
 * const area = polygonArea(polygon); // Area in square meters
 * ```
 */
export function polygonArea(polygon: Polygon): number {
  const coordinates = polygon.coordinates[0]; // Outer ring
  if (!coordinates || coordinates.length < 4) {
    return 0;
  }

  try {
    // Turf expects GeoJSON format which already uses [lon, lat]
    const turfPoly = turfPolygon(polygon.coordinates);
    const area = turfArea(turfPoly);

    // Validate result
    if (typeof area === 'number' && !isNaN(area) && isFinite(area) && area >= 0) {
      return area;
    }
  } catch {
    // Fall through to return 0
  }

  return 0;
}

/**
 * Calculate the area of a polygon in square kilometers
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in square kilometers
 */
export function polygonAreaKm(polygon: Polygon): number {
  return polygonArea(polygon) / SQUARE_METERS_TO_SQUARE_KILOMETERS;
}

/**
 * Calculate the area of a polygon in square miles
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in square miles
 */
export function polygonAreaMiles(polygon: Polygon): number {
  return polygonArea(polygon) / SQUARE_METERS_TO_SQUARE_MILES;
}

/**
 * Calculate the area of a polygon in acres
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in acres
 */
export function polygonAreaAcres(polygon: Polygon): number {
  return polygonArea(polygon) / SQUARE_METERS_TO_ACRES;
}
