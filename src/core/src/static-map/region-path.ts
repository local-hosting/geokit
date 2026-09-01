import type { LatLon } from '../types/index';
import { simplifyPolygonRingToMaxPoints } from '../utils/simplify/index';
import type { Position } from 'geojson';

import type { MapRegionPathStyle } from '../types/static-map';
export type { MapRegionPathStyle };

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
/** Google-encoded polyline (precision 5) for Mapbox Static Images path overlays. */
export function encodePolyline(coordinates: [number, number][]): string {
  let lastLat = 0;
  let lastLng = 0;
  let encoded = '';

  for (const [lat, lng] of coordinates) {
    const roundedLat = Math.round(lat * 1e5);
    const roundedLng = Math.round(lng * 1e5);
    encoded += encodeSignedNumber(roundedLat - lastLat);
    encoded += encodeSignedNumber(roundedLng - lastLng);
    lastLat = roundedLat;
    lastLng = roundedLng;
  }

  return encoded;
}

function encodeSignedNumber(value: number): string {
  let signed = value << 1;
  if (value < 0) signed = ~signed;

  let chunk = '';
  while (signed >= 0x20) {
    chunk += String.fromCharCode((0x20 | (signed & 0x1f)) + 63);
    signed >>= 5;
  }
  chunk += String.fromCharCode(signed + 63);
  return chunk;
}

