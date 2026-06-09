/**
 * Convert polygon features into boundary LineStrings for MapLibre line layers.
 * Emits one multi-point LineString per exterior ring so geojson-vt keeps borders
 * visible at low zoom (two-point segment dedupe produces sub-pixel fragments).
 */

import type { FeatureCollection, LineString, Position } from '../../types';

function exteriorRings(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): Position[][] {
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0];
    return ring ? [ring] : [];
  }
  return geometry.coordinates
    .map((polygon) => polygon[0])
    .filter((ring): ring is Position[] => !!ring?.length);
}

/** One LineString per polygon exterior ring (shared borders may render twice). */
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
      features.push({
        type: 'Feature',
        properties: feature.properties ?? {},
        geometry: {
          type: 'LineString',
          coordinates: ring,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}
