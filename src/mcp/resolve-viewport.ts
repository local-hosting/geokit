import { calculateCenterAndZoom } from '@twinfile/geokit/bounds';
import type { Bounds } from '@twinfile/geokit/types';
import type { MapViewInput, MapViewport } from '../types/mcp-map.js';
import { calculateFitBoundsViewport } from './fit-bounds-viewport.js';
import { DEFAULT_MAP_FIT_PADDING } from './static-map.js';

const DEFAULT_ZOOM = 12;

export type ResolveMapViewportOptions = {
  width?: number;
  height?: number;
  /** When true and bounds exist, compute zoom to fit the image frame. */
  fitToBounds?: boolean;
  padding?: number;
};

export function resolveMapViewport(
  input: MapViewInput,
  options?: ResolveMapViewportOptions
): MapViewport {
  if (input.bounds?.length === 4 && input.zoom == null) {
    const width = options?.width ?? input.width ?? 600;
    const height = options?.height ?? input.height ?? 400;
    if (options?.fitToBounds ?? true) {
      return calculateFitBoundsViewport(
        input.bounds as Bounds,
        width,
        height,
        options?.padding ?? DEFAULT_MAP_FIT_PADDING
      );
    }

    const result = calculateCenterAndZoom(input.bounds as Bounds);
    if (result) {
      return {
        lat: result.lat,
        lng: result.lng,
        zoom: result.zoom,
      };
    }
  }

  if (input.bounds?.length === 4 && input.zoom != null) {
    const result = calculateCenterAndZoom(input.bounds as Bounds);
    if (result) {
      return {
        lat: result.lat,
        lng: result.lng,
        zoom: input.zoom,
      };
    }
  }

  if (typeof input.lat === 'number' && typeof input.lng === 'number') {
    return {
      lat: input.lat,
      lng: input.lng,
      zoom: input.zoom ?? DEFAULT_ZOOM,
    };
  }

  throw new Error('Map view requires lat/lng or bounds [minLon, minLat, maxLon, maxLat]');
}
