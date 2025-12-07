import type { Polygon, MultiPolygon, Position } from '../../types';

/**
 * Fix ring ordering for Polygon geometries
 * Ensures the largest ring (outer boundary) is first
 * This is important for proper polygon rendering and spatial operations
 *
 * @param geometry - GeoJSON Polygon geometry
 * @returns Geometry with corrected ring order (largest ring first)
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [
 *     [[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.8], [-74.0, 40.7]], // small ring
 *     [[-75.0, 40.0], [-73.0, 40.0], [-73.0, 41.0], [-75.0, 41.0], [-75.0, 40.0]] // large ring (should be first)
 *   ]
 * };
 * const fixed = fixPolygonRingOrder(polygon);
 * // Largest ring is now first
 * ```
 */
export function fixPolygonRingOrder(geometry: Polygon): Polygon {
  if (!geometry || geometry.type !== 'Polygon' || !geometry.coordinates) {
    return geometry;
  }

  const rings = geometry.coordinates;
  if (rings.length <= 1) {
    return geometry; // No reordering needed for single ring
  }

  // Find the largest ring (should be the outer boundary)
  let largestIndex = 0;
  let largestSize = rings[0] ? rings[0].length : 0;

  for (let i = 1; i < rings.length; i++) {
    if (rings[i] && rings[i].length > largestSize) {
      largestIndex = i;
      largestSize = rings[i].length;
    }
  }

  // If the largest ring is not first, reorder
  if (largestIndex !== 0) {
    const reorderedRings = [
      rings[largestIndex],
      ...rings.slice(0, largestIndex),
      ...rings.slice(largestIndex + 1),
    ];
    return {
      ...geometry,
      coordinates: reorderedRings,
    };
  }

  return geometry;
}

/**
 * Filter out tiny polygons from a MultiPolygon based on minimum point count
 * Useful for removing small islands or artifacts from geometry processing
 *
 * @param geometry - GeoJSON MultiPolygon geometry
 * @param minPoints - Minimum number of points required per polygon (default: 10)
 * @returns MultiPolygon with tiny polygons removed, or original geometry if not a MultiPolygon
 *
 * @example
 * ```typescript
 * const multiPolygon = {
 *   type: 'MultiPolygon',
 *   coordinates: [
 *     [[[-74.0, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.0, 40.8], [-74.0, 40.7]]], // 5 points - will be removed
 *     [[[-75.0, 40.0], [-73.0, 40.0], [-73.0, 41.0], [-75.0, 41.0], [-75.0, 40.0], ...]] // 20 points - kept
 *   ]
 * };
 * const filtered = filterTinyPolygons(multiPolygon, 10);
 * // Only polygons with >= 10 points remain
 * ```
 */
export function filterTinyPolygons(geometry: MultiPolygon, minPoints: number = 10): MultiPolygon {
  if (!geometry || geometry.type !== 'MultiPolygon') {
    return geometry;
  }

  const filtered = geometry.coordinates.filter((polygon) => {
    const outerRing = polygon[0];
    return outerRing && outerRing.length >= minPoints;
  });

  if (filtered.length === 0) {
    // Keep at least the largest polygon to avoid empty geometry
    const largest = geometry.coordinates.reduce((max, p) =>
      (p[0]?.length || 0) > (max[0]?.length || 0) ? p : max
    );
    return { ...geometry, coordinates: [largest] };
  }

  return { ...geometry, coordinates: filtered };
}

/**
 * Validate and clean coordinates in a geometry
 * Removes invalid coordinates (NaN, null, malformed arrays)
 * This is a simpler, more focused alternative to repairGeometry
 *
 * @param geometry - GeoJSON geometry (Polygon or MultiPolygon)
 * @returns Geometry with cleaned coordinates, or original if not a Polygon/MultiPolygon
 *
 * @example
 * ```typescript
 * const polygon = {
 *   type: 'Polygon',
 *   coordinates: [
 *     [[-74.0, 40.7], [NaN, 40.7], [-73.9, 40.8], null, [-74.0, 40.8], [-74.0, 40.7]]
 *   ]
 * };
 * const cleaned = cleanGeometry(polygon);
 * // Invalid coordinates removed
 * ```
 */
export function cleanGeometry(geometry: Polygon | MultiPolygon): Polygon | MultiPolygon {
  if (!geometry || !geometry.coordinates) {
    return geometry;
  }

  const cleanRing = (ring: unknown): Position[] | null => {
    if (!Array.isArray(ring)) {
      return null;
    }

    const cleaned: Position[] = [];
    for (const coord of ring) {
      if (Array.isArray(coord) && coord.length >= 2) {
        const [lon, lat] = coord;
        if (
          typeof lon === 'number' &&
          typeof lat === 'number' &&
          !isNaN(lon) &&
          !isNaN(lat) &&
          isFinite(lon) &&
          isFinite(lat)
        ) {
          cleaned.push([lon, lat] as Position);
        }
      }
    }

    return cleaned.length >= 3 ? cleaned : null; // Need at least 3 points for a valid ring
  };

  if (geometry.type === 'Polygon') {
    const cleanedRings = geometry.coordinates
      .map((ring) => cleanRing(ring))
      .filter((ring): ring is Position[] => ring !== null);

    if (cleanedRings.length === 0) {
      return geometry; // Return original if all rings invalid
    }

    return {
      ...geometry,
      coordinates: cleanedRings,
    };
  } else if (geometry.type === 'MultiPolygon') {
    const cleanedPolygons = geometry.coordinates
      .map((polygon) => {
        const cleanedRings = polygon
          .map((ring) => cleanRing(ring))
          .filter((ring): ring is Position[] => ring !== null);
        return cleanedRings.length > 0 ? cleanedRings : null;
      })
      .filter((polygon): polygon is Position[][] => polygon !== null);

    if (cleanedPolygons.length === 0) {
      return geometry; // Return original if all polygons invalid
    }

    return {
      ...geometry,
      coordinates: cleanedPolygons,
    };
  }

  return geometry;
}
