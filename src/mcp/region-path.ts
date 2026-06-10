import type { LatLon } from '@twinfile/geokit/types';
import { simplifyPolygonRingToMaxPoints } from '../utils/simplify/polygon.js';
import type { Position } from 'geojson';

export type MapRegionPathStyle = {
  fill: string;
  stroke: string;
  width: number;
};

/** Hex colors — encoded as %23 in static path strings (literal # breaks URLs). */
export const DEFAULT_REGION_PATH_STYLE: MapRegionPathStyle = {
  fill: '%2338bdf850',
  stroke: '%23ffffff',
  width: 4,
};

const DEFAULT_MAX_POINTS_PER_RING = 80;
/** Spread across rings so multi-island DMAs stay under static map URL limits. */
const STATIC_MAP_MULTI_RING_POINT_BUDGET = 96;
const STATIC_MAP_MIN_POINTS_PER_RING = 8;

function maxPointsPerRing(ringCount: number, requested?: number): number {
  if (requested != null) return requested;
  if (ringCount <= 1) return DEFAULT_MAX_POINTS_PER_RING;
  return Math.max(
    STATIC_MAP_MIN_POINTS_PER_RING,
    Math.floor(STATIC_MAP_MULTI_RING_POINT_BUDGET / ringCount)
  );
}

function extractExteriorRings(geometry: GeoJSON.Geometry): Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates[0] ? [geometry.coordinates[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon) => polygon[0])
      .filter((ring): ring is Position[] => Boolean(ring?.length));
  }
  return [];
}

function simplifyRing(ring: Position[], maxPoints: number): Position[] {
  const latLonRing: LatLon[] = ring.map(([lon, lat]) => [lat, lon]);
  const simplified = simplifyPolygonRingToMaxPoints(maxPoints)(latLonRing);
  return simplified.map(([lat, lon]: LatLon) => [lon, lat]);
}

export function simplifyGeometryRings(
  geometry: GeoJSON.Geometry,
  options?: { maxPointsPerRing?: number }
): Position[][] {
  const rings = extractExteriorRings(geometry);
  const maxPoints = maxPointsPerRing(rings.length, options?.maxPointsPerRing);
  return rings.map((ring) => simplifyRing(ring, maxPoints));
}
