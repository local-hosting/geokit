import turfArea from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import type { Polygon } from '../types';

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
  return polygonArea(polygon) / 1000000; // Convert m² to km²
}

/**
 * Calculate the area of a polygon in square miles
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in square miles
 */
export function polygonAreaMiles(polygon: Polygon): number {
  return polygonArea(polygon) / 2589988.110336; // Convert m² to mi²
}

/**
 * Calculate the area of a polygon in acres
 *
 * @param polygon - GeoJSON Polygon geometry
 * @returns Area in acres
 */
export function polygonAreaAcres(polygon: Polygon): number {
  return polygonArea(polygon) / 4046.8564224; // Convert m² to acres
}
