import type { Bounds } from '../types';
import { getCenter } from './get-center';

/**
 * Calculate map zoom level from bounding box
 * Provides a reasonable zoom level to fit the bounds in a map viewport
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Zoom level (typically 0-18 for web maps)
 *
 * @example
 * ```typescript
 * const bounds = [-74.1, 40.6, -73.9, 40.8];
 * const zoom = calculateZoomFromBounds(bounds);
 * // 11
 * ```
 */
export function calculateZoomFromBounds(bounds: Bounds): number {
  const [minLon, minLat, maxLon, maxLat] = bounds;

  const latDiff = maxLat - minLat;
  const lngDiff = maxLon - minLon;
  const maxDiff = Math.max(latDiff, lngDiff);

  // Handle single point case (zero-size bbox) - use reasonable zoom level
  if (maxDiff === 0 || (maxDiff < 0.0001 && maxDiff >= 0)) {
    return 10; // Single point or very small bbox - use zoom 10 for good visibility
  }

  // Zoom calculation - tighter fit (less padding)
  if (maxDiff > 60) return 3;
  if (maxDiff > 30) return 4;
  if (maxDiff > 15) return 5;
  if (maxDiff > 8) return 6;
  if (maxDiff > 4) return 7;
  if (maxDiff > 2) return 8;
  if (maxDiff > 1) return 9;
  if (maxDiff > 0.5) return 10;
  if (maxDiff > 0.25) return 11;
  if (maxDiff > 0.1) return 12;
  if (maxDiff > 0.05) return 13;
  if (maxDiff > 0.025) return 14;
  if (maxDiff > 0.01) return 15;
  if (maxDiff > 0.005) return 16;
  if (maxDiff > 0.0025) return 17;
  return 18;
}

/**
 * Calculate center and zoom from bounding box
 * Combines getCenter and calculateZoomFromBounds for convenience
 *
 * @param bounds - Bounding box [minLon, minLat, maxLon, maxLat]
 * @returns Object with center [lat, lon] and zoom level, or null if invalid
 *
 * @example
 * ```typescript
 * const bounds = [-74.1, 40.6, -73.9, 40.8];
 * const result = calculateCenterAndZoom(bounds);
 * // { lat: 40.7, lng: -74.0, zoom: 11 }
 * ```
 */
export function calculateCenterAndZoom(bounds: Bounds): {
  lat: number;
  lng: number;
  zoom: number;
} | null {
  if (!bounds || bounds.length !== 4) {
    return null;
  }

  // Use Turf.js via getCenter for accurate center calculation
  const center = getCenter(bounds);
  if (!center) {
    return null;
  }

  const [centerLat, centerLng] = center;
  const zoom = calculateZoomFromBounds(bounds);

  return { lat: centerLat, lng: centerLng, zoom };
}
