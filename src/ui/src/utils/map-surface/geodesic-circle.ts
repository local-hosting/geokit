/**
 * Geodesic circle polygons and optional fill layers around a map point.
 */

import type { MapInstance } from '../../providers/types';

const MILES_TO_METERS = 1609.34;
const DEFAULT_RING_STEPS = 64;
const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] as unknown[] };

export interface GeodesicRadiusRingSpec {
  miles: number;
  fillColor?: string;
  fillOpacity?: number;
}

export interface GeodesicRadiusRingLayerIds {
  sourceId: string;
  fillLayerId: string;
}

/**
 * Generate a GeoJSON polygon ring (circle) around a center point.
 * Uses the haversine destination formula for geodesic accuracy.
 */
export function generateGeodesicCirclePolygon(
  lng: number,
  lat: number,
  radiusMeters: number,
  steps = DEFAULT_RING_STEPS
): [number, number][] {
  const coords: [number, number][] = [];
  const latRad = lat * DEG_TO_RAD;
  const lngRad = lng * DEG_TO_RAD;
  const angDist = radiusMeters / EARTH_RADIUS_M;

  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const dLat = Math.asin(
      Math.sin(latRad) * Math.cos(angDist) +
        Math.cos(latRad) * Math.sin(angDist) * Math.cos(bearing)
    );
    const dLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angDist) * Math.cos(latRad),
        Math.cos(angDist) - Math.sin(latRad) * Math.sin(dLat)
      );
    coords.push([dLng * RAD_TO_DEG, dLat * RAD_TO_DEG]);
  }

  return coords;
}

export function getGeodesicRadiusRingLayerIds(
  scopeId: string,
  miles: number
): GeodesicRadiusRingLayerIds {
  return {
    sourceId: `radius-ring-${miles}mi-${scopeId}`,
    fillLayerId: `radius-ring-fill-${miles}mi-${scopeId}`,
  };
}

/**
 * Pre-create geodesic radius ring sources + fill layers (once, with empty data).
 */
export function ensureGeodesicRadiusRingLayers(
  map: MapInstance,
  scopeId: string,
  rings: readonly GeodesicRadiusRingSpec[],
  options?: { beforeLayerId?: string; ringSteps?: number }
): void {
  void options?.ringSteps;
  const beforeLayerId = options?.beforeLayerId;

  for (const ring of rings) {
    const { sourceId, fillLayerId } = getGeodesicRadiusRingLayerIds(scopeId, ring.miles);

    if (!map.getSource?.(sourceId)) {
      map.addSource?.(sourceId, { type: 'geojson', data: EMPTY_FC });
    }

    if (!map.getLayer?.(fillLayerId)) {
      const fillSpec: Record<string, unknown> = {
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': ring.fillColor ?? '#ffffff',
          'fill-opacity': ring.fillOpacity ?? 0.05,
        },
      };
      if (beforeLayerId && map.getLayer?.(beforeLayerId)) {
        map.addLayer?.(fillSpec as never, beforeLayerId);
      } else {
        map.addLayer?.(fillSpec as never);
      }
    }
  }
}

/** Update all geodesic radius ring polygons for a scope (or clear them). */
export function updateGeodesicRadiusRingData(
  map: MapInstance,
  scopeId: string,
  rings: readonly GeodesicRadiusRingSpec[],
  coords: { lng: number; lat: number } | null,
  ringSteps = DEFAULT_RING_STEPS
): void {
  for (const ring of rings) {
    const { sourceId } = getGeodesicRadiusRingLayerIds(scopeId, ring.miles);
    const source = map.getSource?.(sourceId) as { setData?(data: unknown): void } | undefined;
    if (!source?.setData) continue;

    if (!coords) {
      source.setData(EMPTY_FC);
      continue;
    }

    const radiusMeters = ring.miles * MILES_TO_METERS;
    const polygon = generateGeodesicCirclePolygon(coords.lng, coords.lat, radiusMeters, ringSteps);
    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [polygon] },
          properties: { miles: ring.miles },
        },
      ],
    });
  }
}
