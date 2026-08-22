/**
 * Resolve a point to a property value from the containing GeoJSON feature.
 * Uses point-in-polygon first; falls back to nearest feature by centroid distance when PIP misses.
 *
 * Generic utility for any GeoJSON FeatureCollection with Polygon/MultiPolygon geometry.
 * Use case: resolve (lon, lat) to a property (e.g. regionId, territoryId) from boundary features.
 */

import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type { LatLon } from '../../types';
import { pointInGeometry } from './point-in-geometry';
import { polygonCentroid } from '../centroid/polygon';
import { haversineMeters } from '../distance/haversine';
import { toLatLon } from '../coordinates/conversion';

type FeatureWithGeometry = Feature<Polygon | MultiPolygon>;

/**
 * Get centroid of a Polygon or MultiPolygon geometry (uses first polygon for MultiPolygon).
 */
function getGeometryCentroid(geom: Polygon | MultiPolygon): LatLon | null {
  if (!geom?.coordinates) return null;
  if (geom.type === 'Polygon') {
    return polygonCentroid(geom);
  }
  if (geom.type === 'MultiPolygon' && geom.coordinates[0]?.[0]) {
    const firstPoly: Polygon = { type: 'Polygon', coordinates: geom.coordinates[0] };
    return polygonCentroid(firstPoly);
  }
  return null;
}

/**
 * Resolve a point to a property value from the containing feature.
 * Point-in-polygon first; falls back to nearest feature by centroid distance.
 *
 * @param point - Point in GeoJSON order [lon, lat]
 * @param features - GeoJSON features with Polygon or MultiPolygon geometry
 * @param propertyKey - Property key to extract (e.g. 'regionSlug', 'regionId')
 * @returns Property value of containing/nearest feature, or null
 *
 * @example
 * ```typescript
 * const features = countyFeatureCollection.features;
 * const regionSlug = resolvePointToFeatureProperty([-74.0, 40.7], features, 'regionSlug');
 * ```
 */
export function resolvePointToFeatureProperty<T = string>(
  point: [number, number],
  features: FeatureWithGeometry[],
  propertyKey: string
): T | null {
  const pointLatLon: LatLon = toLatLon(point);

  // 1. Point-in-polygon: find containing feature
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;
    const prop = f.properties?.[propertyKey];
    if (prop == null) continue;
    if (pointInGeometry(pointLatLon, geom)) {
      return prop as T;
    }
  }

  // 2. Fallback: nearest feature by centroid distance
  let bestValue: T | null = null;
  let bestDist = Infinity;
  for (const f of features) {
    const prop = f.properties?.[propertyKey];
    if (prop == null) continue;
    const centroid = getGeometryCentroid(f.geometry);
    if (!centroid) continue;
    const dist = haversineMeters(pointLatLon)(centroid);
    if (dist < bestDist) {
      bestDist = dist;
      bestValue = prop as T;
    }
  }
  return bestValue;
}
