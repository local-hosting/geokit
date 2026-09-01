

import type { Polygon, MultiPolygon, Position } from '../../types';
import { turfArea, turfPolygon } from '../turf/deps';

/** ~0.01 km² — spurious simplify slivers are orders of magnitude smaller. */
const DEFAULT_MIN_HOLE_AREA_M2 = 10_000;
/** Bbox long/short ratio above which a hole is treated as a sliver. */
const DEFAULT_MAX_SLIVER_ASPECT = 50;
/** Default off — callers opt in (e.g. region dissolve passes ~500). */
const DEFAULT_MIN_HOLE_WIDTH_M2 = 0;

export type StripDegenerateInteriorRingsOptions = {
  minHoleAreaM2?: number;
  maxSliverAspect?: number;
  /** Drop holes whose shorter bbox side is below this width (meters). 0 disables. */
  minHoleWidthM2?: number;
};

function ringBBoxAspect(ring: Position[]): number {
  if (ring.length < 2) return 1;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const width = maxLon - minLon;
  const height = maxLat - minLat;
  if (width === 0 && height === 0) return 1;

  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height) || longSide;
  return longSide / shortSide;
}

function ringMinWidthM(ring: Position[]): number {
  if (ring.length < 2) return 0;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const midLat = (minLat + maxLat) / 2;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos((midLat * Math.PI) / 180);
  const widthM = (maxLon - minLon) * metersPerDegLon;
  const heightM = (maxLat - minLat) * metersPerDegLat;

  return Math.min(widthM, heightM);
}

function ringAreaM2(ring: Position[]): number {
  if (ring.length < 4) return 0;

  try {
    const coords = [...ring];
    const [lon0, lat0] = coords[0];
    const [lonN, latN] = coords[coords.length - 1];
    if (lon0 !== lonN || lat0 !== latN) {
      coords.push([lon0, lat0]);
    }

    const area = turfArea(turfPolygon([coords]));
    return typeof area === 'number' && isFinite(area) ? Math.abs(area) : 0;
  } catch {
    return 0;
  }
}

function isDegenerateHole(
  ring: Position[],
  options: Required<StripDegenerateInteriorRingsOptions>
): boolean {
  const area = ringAreaM2(ring);
  if (area < options.minHoleAreaM2) return true;

  if (options.minHoleWidthM2 > 0 && ringMinWidthM(ring) < options.minHoleWidthM2) {
    return true;
  }

  if (ringBBoxAspect(ring) >= options.maxSliverAspect) {
    return true;
  }

  return false;
}

function stripPolygonHoles(
  polygon: Position[][],
  options: Required<StripDegenerateInteriorRingsOptions>
): Position[][] {
  if (polygon.length <= 1) return polygon;

  const outer = polygon[0];
  const holes = polygon.slice(1).filter((hole) => !isDegenerateHole(hole, options));
  return holes.length > 0 ? [outer, ...holes] : [outer];
}

/**
 * Remove interior rings introduced by simplify/round (self-touch slivers, micro-loops).
 * Preserves large holes (e.g. counties in another region fully enclosed by this region).
 */
export function stripDegenerateInteriorRings(
  geometry: Polygon | MultiPolygon,
  options: StripDegenerateInteriorRingsOptions = {}
): Polygon | MultiPolygon {
  if (!geometry?.coordinates) return geometry;

  const resolved: Required<StripDegenerateInteriorRingsOptions> = {
    minHoleAreaM2: options.minHoleAreaM2 ?? DEFAULT_MIN_HOLE_AREA_M2,
    maxSliverAspect: options.maxSliverAspect ?? DEFAULT_MAX_SLIVER_ASPECT,
    minHoleWidthM2: options.minHoleWidthM2 ?? DEFAULT_MIN_HOLE_WIDTH_M2,
  };

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: stripPolygonHoles(geometry.coordinates, resolved),
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((poly) => stripPolygonHoles(poly, resolved)),
    };
  }

  return geometry;
}

/** Default — union/simplify micro-notches; keeps county corners (~90°). */
const DEFAULT_MIN_OUTER_SPIKE_ANGLE_DEG = 12;

export type StripAcuteOuterRingSpikesOptions = {
  /** Drop outer-ring vertices whose interior angle is below this (degrees). */
  minInteriorAngleDeg?: number;
  /** Safety cap on iterative passes. */
  maxPasses?: number;
};

function ringInteriorAngleDeg(prev: Position, cur: Position, next: Position): number {
  const v1x = prev[0] - cur[0];
  const v1y = prev[1] - cur[1];
  const v2x = next[0] - cur[0];
  const v2y = next[1] - cur[1];
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 180;

  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function openRingPoints(ring: Position[]): Position[] {
  if (ring.length < 2) return [...ring];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return [...ring];
}

function closeRingPoints(points: Position[]): Position[] {
  if (points.length === 0) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return points;
  }
  return [...points, [first[0], first[1]] as Position];
}

function stripAcuteVerticesFromRing(
  ring: Position[],
  minInteriorAngleDeg: number,
  maxPasses: number
): Position[] {
  let open = openRingPoints(ring);
  if (open.length < 3) return closeRingPoints(open);

  for (let pass = 0; pass < maxPasses; pass++) {
    if (open.length < 3) break;

    const next: Position[] = [];
    let removed = false;

    for (let i = 0; i < open.length; i++) {
      const prev = open[(i - 1 + open.length) % open.length];
      const cur = open[i];
      const nxt = open[(i + 1) % open.length];
      const angle = ringInteriorAngleDeg(prev, cur, nxt);

      if (angle >= minInteriorAngleDeg) {
        next.push(cur);
      } else {
        removed = true;
      }
    }

    if (!removed || next.length < 3) {
      open = next.length >= 3 ? next : open;
      break;
    }

    open = next;
  }

  return closeRingPoints(open);
}

/**
 * Remove micro-spikes on outer rings (union/simplify notches that read as inward lines).
 * Interior holes are unchanged — use stripDegenerateInteriorRings for those.
 */
export function stripAcuteOuterRingSpikes(
  geometry: Polygon | MultiPolygon,
  options: StripAcuteOuterRingSpikesOptions = {}
): Polygon | MultiPolygon {
  if (!geometry?.coordinates) return geometry;

  const minInteriorAngleDeg = options.minInteriorAngleDeg ?? DEFAULT_MIN_OUTER_SPIKE_ANGLE_DEG;
  const maxPasses = options.maxPasses ?? 24;

  const stripPolygon = (polygon: Position[][]): Position[][] => {
    if (polygon.length === 0) return polygon;
    const outer = stripAcuteVerticesFromRing(polygon[0], minInteriorAngleDeg, maxPasses);
    return polygon.length > 1 ? [outer, ...polygon.slice(1)] : [outer];
  };

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: stripPolygon(geometry.coordinates),
    };
  }

  return {
    ...geometry,
    coordinates: geometry.coordinates.map(stripPolygon),
  };
}

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
