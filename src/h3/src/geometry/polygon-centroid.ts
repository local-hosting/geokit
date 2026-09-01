import type { LatLon, Polygon } from '../types';

/** Bbox-center centroid for polygon rings (lightweight; no Turf). */
export function polygonCentroid(polygon: Polygon): LatLon | null {
  const ring = polygon.coordinates[0];
  if (!ring?.length) return null;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];
}
