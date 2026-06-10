import { simplifyPolygonRingToMaxPoints } from '@twinfile/geokit/simplify';
import type { LatLon } from '@twinfile/geokit/types';
import type { Position } from 'geojson';

export type MapRegionPathStyle = {
  fill: string;
  stroke: string;
  width: number;
};

/** Hex colors — encoded as %23 in MapTiler path strings (literal # breaks URLs). */
export const DEFAULT_REGION_PATH_STYLE: MapRegionPathStyle = {
  fill: '%2338bdf850',
  stroke: '%23ffffff',
  width: 4,
};

const DEFAULT_MAX_POINTS_PER_RING = 80;

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

function ringToMaptilerPath(ring: Position[], style: MapRegionPathStyle): string {
  const pairs = ring.map(([lon, lat]) => `${lon},${lat}`);
  const stylePrefix = [`fill:${style.fill}`, `stroke:${style.stroke}`, `width:${style.width}`].join(
    '|'
  );
  return `${stylePrefix}|${pairs.join('|')}`;
}

export function geometryToMaptilerPaths(
  geometry: GeoJSON.Geometry,
  options?: {
    maxPointsPerRing?: number;
    style?: Partial<MapRegionPathStyle>;
  }
): string[] {
  const maxPoints = options?.maxPointsPerRing ?? DEFAULT_MAX_POINTS_PER_RING;
  const style = { ...DEFAULT_REGION_PATH_STYLE, ...options?.style };

  return extractExteriorRings(geometry).map((ring) => {
    const simplified = simplifyRing(ring, maxPoints);
    return ringToMaptilerPath(simplified, style);
  });
}
