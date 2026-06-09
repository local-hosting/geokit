/**
 * Convert polygon features into boundary LineStrings for MapLibre line layers.
 * Large rings are split into chunks — MapLibre line buckets cap at 65535 verts/segment.
 */

import type { FeatureCollection, LineString, Position } from '../../types';

/** Stay under MapLibre's 65535 vertex line-bucket limit (with tile merge headroom). */
export const MAPLIBRE_BOUNDARY_LINE_VERTEX_CHUNK = 8192;

function exteriorRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Position[][] {
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
