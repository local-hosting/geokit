import type { Polygon } from '../types';

/**
 * Calculate the area of a polygon in square meters
 * Uses spherical excess formula for accurate results on Earth's surface
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

  const R = 6378137; // Earth's radius in meters (WGS-84)
  let area = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    area +=
      (((lon2 - lon1) * Math.PI) / 180) *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }

  area = (Math.abs(area) * R * R) / 2;

  return area;
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
