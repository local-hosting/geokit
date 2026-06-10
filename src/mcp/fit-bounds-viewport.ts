import { getCenter } from '@twinfile/geokit/bounds';
import type { Bounds } from '@twinfile/geokit/types';
import type { MapViewport } from '../types/mcp-map.js';

const MIN_ZOOM = 0;
const MAX_ZOOM = 22;
const WORLD_SIZE = 512;

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(Math.max(sin, -0.9999), 0.9999);
  return Math.log((1 + clamped) / (1 - clamped)) / 2;
}

/**
 * Web Mercator zoom so bounds fit the given pixel viewport (with fractional padding).
 */
export function calculateFitBoundsViewport(
  bounds: Bounds,
  width: number,
  height: number,
  paddingFraction = 0.06
): MapViewport {
  const [minLon, minLat, maxLon, maxLat] = bounds;
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const padLat = latSpan * paddingFraction;
  const padLon = lonSpan * paddingFraction;

  const padded: Bounds = [minLon - padLon, minLat - padLat, maxLon + padLon, maxLat + padLat];

  const center = getCenter(padded);
  if (!center) {
    throw new Error('Could not compute center for bounds');
  }
  const [lat, lng] = center;

  const latFraction = (latRad(padded[3]) - latRad(padded[1])) / Math.PI;
  const lngFraction = (padded[2] - padded[0]) / 360;

  const latZoom = latFraction > 0 ? Math.log2(height / WORLD_SIZE / latFraction) : MAX_ZOOM;
  const lngZoom = lngFraction > 0 ? Math.log2(width / WORLD_SIZE / lngFraction) : MAX_ZOOM;

  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(latZoom, lngZoom)));

  return { lat, lng, zoom: Math.floor(zoom * 100) / 100 };
}
