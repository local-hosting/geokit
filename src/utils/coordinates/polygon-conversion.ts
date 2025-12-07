import type { Polygon, MultiPolygon, LatLon } from '../types';

/**
 * Convert GeoJSON Polygon coordinates to [lat, lon] format
 * GeoJSON uses [lon, lat], this converts to [lat, lon] for mapi-polygon format
 * Handles both Polygon and MultiPolygon geometry types
 * Returns an array of polygons (single element for Polygon, multiple for MultiPolygon)
 *
 * @param geometry - GeoJSON Polygon or MultiPolygon geometry
 * @returns Array of polygon coordinate arrays in [lat, lon] format, or null if invalid
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [[[-74.1, 40.6], [-73.9, 40.6], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.6]]]
 * };
 * const converted = geojsonPolygonToLatLon(polygon);
 * // [[[40.6, -74.1], [40.6, -73.9], [40.8, -73.9], [40.8, -74.1], [40.6, -74.1]]]
 * ```
 */
export function geojsonPolygonToLatLon(geometry: Polygon | MultiPolygon): LatLon[][] | null {
  if (!geometry || !geometry.coordinates) {
    return null;
  }

  // Handle Polygon: coordinates are [[[lng, lat], [lng, lat], ...]]
  if (geometry.type === 'Polygon') {
    if (!geometry.coordinates[0]) {
      return null;
    }

    // Find the largest ring (heuristic: sometimes data has rings in wrong order)
    const rings = geometry.coordinates;
    const firstRingSize = rings[0] ? rings[0].length : 0;

    let outerRing = rings[0];
    if (firstRingSize < 10 && rings.length > 1) {
      // Find the largest ring
      let largestRing = rings[0];
      let largestSize = firstRingSize;
      for (let i = 1; i < rings.length; i++) {
        if (rings[i] && rings[i].length > largestSize) {
          largestRing = rings[i];
          largestSize = rings[i].length;
        }
      }
      // Use largest ring if it's significantly larger (at least 2x)
      if (largestSize >= firstRingSize * 2) {
        outerRing = largestRing;
      }
    }

    // Convert from [lng, lat] to [lat, lng]
    return [outerRing.map((coord) => [coord[1], coord[0]] as LatLon)];
  }

  // Handle MultiPolygon: coordinates are [[[[lng, lat], [lng, lat], ...]], ...]
  if (geometry.type === 'MultiPolygon') {
    if (!geometry.coordinates[0] || !geometry.coordinates[0][0]) {
      return null;
    }

    // Convert all polygons in the MultiPolygon
    const polygons: LatLon[][] = [];
    for (const polygon of geometry.coordinates) {
      if (polygon && polygon[0] && Array.isArray(polygon[0])) {
        // Use the outer ring of each polygon
        const ring = polygon[0];
        // Convert from [lng, lat] to [lat, lng]
        polygons.push(ring.map((coord) => [coord[1], coord[0]] as LatLon));
      }
    }

    return polygons.length > 0 ? polygons : null;
  }

  return null;
}
