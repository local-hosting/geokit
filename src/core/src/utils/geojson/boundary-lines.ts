import { lineString, simplifyTurf } from '../turf/deps';
/**
 * Convert polygon features into boundary LineStrings for MapLibre line layers.
 * Large rings are split into chunks — MapLibre line buckets cap at 65535 verts/segment
 * and round-join tessellation can expand ~10× the input coordinate count.
 */



import type { FeatureCollection, LineString, Polygon, MultiPolygon, Position } from '../../types';

/**
 * Input coordinate budget per LineString chunk.
 * Tessellation at round joins can expand ~10× before hitting the 65535 GPU limit.
 */
export const MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK = 2048;

/** Match host shape export ring budget — keeps fill + line sources aligned. */
export const BOUNDARY_POLYGON_RING_MAX = 900;

/** @deprecated Use BOUNDARY_POLYGON_RING_MAX */
export const ADMIN_POLYGON_RING_MAX = BOUNDARY_POLYGON_RING_MAX;

function exteriorRings(geometry: Polygon | MultiPolygon): Position[][] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return ring ? [ring] : [];
  }
  return geometry.coordinates
    .map((polygon) => polygon[0])
    .filter((ring): ring is Position[] => !!ring?.length);
}

function openRingPoints(ring: Position[]): Position[] {
  if (ring.length < 2) return [...ring];
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring.slice(0, -1);
  return [...ring];
}

function closeRing(open: Position[]): Position[] {
  if (open.length === 0) return open;
  const first = open[0]!;
  const last = open[open.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return open;
  return [...open, first];
}

function simplifyRing(ring: Position[], tolerance: number): Position[] {
  const open = openRingPoints(ring);
  if (open.length <= 2) return closeRing(open);
  const simplified = simplifyTurf(lineString(open), { tolerance, highQuality: true });
  const coords = simplified.geometry.type === 'LineString' ? simplified.geometry.coordinates : open;
  return closeRing(coords);
}

function hardDecimateRing(ring: Position[], maxPoints: number): Position[] {
  const open = openRingPoints(ring);
  if (open.length + 1 <= maxPoints) return closeRing(open);
  const step = Math.max(1, Math.ceil(open.length / Math.max(2, maxPoints - 1)));
  const decimated = open.filter((_, index) => index % step === 0);
  return closeRing(decimated.length >= 3 ? decimated : open.slice(0, maxPoints - 1));
}

/** Simplify a closed ring to at most maxPoints (never returns denser than input budget). */
export function capRingToMaxPoints(ring: Position[], maxPoints: number): Position[] {
  if (ring.length <= maxPoints) return ring;

  let lo = 0;
  let hi = 8;
  let best: Position[] | null = null;

  for (let i = 0; i < 22; i += 1) {
    const tolerance = (lo + hi) / 2;
    const candidate = simplifyRing(ring, tolerance);
    if (candidate.length <= maxPoints) {
      best = candidate;
      hi = tolerance;
    } else {
      lo = tolerance;
    }
  }

  if (best) return best;
  return hardDecimateRing(ring, maxPoints);
}

function capPolygonGeometry(
  geometry: Polygon | MultiPolygon,
  maxPoints: number
): Polygon | MultiPolygon {
  if (geometry.type === 'Polygon') {
    const outer = geometry.coordinates[0];
    if (!outer?.length) return geometry;
    return { type: 'Polygon', coordinates: [capRingToMaxPoints(outer, maxPoints)] };
  }

  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map((polygon) => {
      const outer = polygon[0];
      return outer?.length ? [capRingToMaxPoints(outer, maxPoints)] : polygon;
    }),
  };
}

/** Cap exterior rings before polygon fill / geojson-vt — uncapped TIGER rings blow the 65535 mesh limit. */
function ringExceedsBudget(geometry: Polygon | MultiPolygon, maxPoints: number): boolean {
  for (const ring of exteriorRings(geometry)) {
    if (ring.length > maxPoints) return true;
  }
  return false;
}

export function capPolygonCollectionForMapLibre(
  collection: FeatureCollection,
  maxPoints = BOUNDARY_POLYGON_RING_MAX
): FeatureCollection {
  const needsCap = collection.features.some((feature) => {
    const geometry = feature.geometry;
    return (
      geometry != null &&
      (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') &&
      ringExceedsBudget(geometry, maxPoints)
    );
  });
  if (!needsCap) return collection;

  const features: FeatureCollection['features'] = [];

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) {
      features.push(feature);
      continue;
    }
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      features.push(feature);
      continue;
    }

    features.push({
      ...feature,
      geometry: capPolygonGeometry(geometry, maxPoints),
    });
  }

  return { type: 'FeatureCollection', features };
}

/** Split a dense ring into contiguous line chunks for MapLibre line layers. */
export function ringToBoundaryLineChunks(
  ring: Position[],
  maxVertices = MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK
): Position[][] {
  if (ring.length <= maxVertices) return [ring];

  const open = openRingPoints(ring);
  if (open.length <= maxVertices) return [ring];

  const chunks: Position[][] = [];
  const step = maxVertices - 1;

  for (let start = 0; start < open.length - 1; start += step) {
    const segment = open.slice(start, Math.min(open.length, start + maxVertices));
    if (segment.length >= 2) chunks.push(segment);
    if (start + maxVertices >= open.length) break;
  }

  return chunks.length > 0 ? chunks : [ring];
}

/** One or more LineStrings per exterior ring (shared borders may render twice). */
export function polygonsToBoundaryLines(
  collection: FeatureCollection
): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>['features'] = [];

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      continue;
    }

    for (const ring of exteriorRings(geometry)) {
      if (ring.length < 2) continue;
      for (const chunk of ringToBoundaryLineChunks(ring)) {
        features.push({
          type: 'Feature',
          properties: feature.properties ?? {},
          geometry: {
            type: 'LineString',
            coordinates: chunk,
          },
        });
      }
    }
  }

  return { type: 'FeatureCollection', features };
}
