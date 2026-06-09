/**
 * Convert polygon features into deduplicated boundary LineStrings.
 * Line layers on adjacent polygons double-draw shared edges without this step.
 */

import type { FeatureCollection, LineString, Position } from '../../types';

const COORD_PRECISION = 5;

function roundCoord(value: number): number {
  const factor = 10 ** COORD_PRECISION;
  return Math.round(value * factor) / factor;
}

function segmentKey(a: Position, b: Position): string {
  const aKey = `${roundCoord(a[0]!)},${roundCoord(a[1]!)}`;
  const bKey = `${roundCoord(b[0]!)},${roundCoord(b[1]!)}`;
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function exteriorRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Position[][] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return ring ? [ring] : [];
  }
  return geometry.coordinates
    .map((polygon) => polygon[0])
    .filter((ring): ring is Position[] => !!ring?.length);
}

/** One LineString per unique polygon edge (shared borders included once). */
export function polygonsToBoundaryLines(
  collection: FeatureCollection
): FeatureCollection<LineString> {
  const segments = new Map<string, Position[]>();

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      continue;
    }

    for (const ring of exteriorRings(geometry)) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const a = ring[i]!;
        const b = ring[i + 1]!;
        const key = segmentKey(a, b);
        if (!segments.has(key)) segments.set(key, [a, b]);
      }
    }
  }

  return {
    type: 'FeatureCollection',
    features: [...segments.values()].map((coordinates, index) => ({
      type: 'Feature',
      properties: { id: index },
      geometry: { type: 'LineString', coordinates },
    })),
  };
}
