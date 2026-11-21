/**
 * Geokit Point Component
 *
 * Creates simple geometric points/dots on the map for marking coordinates.
 * Optional glow: set glow or glow="true" for a halo behind the point (off by default). Use glow-color or leave unset to match the point color.
 * Visual states: hover (on mouseover), selected (ring + shadow; attribute `selected` or focus()/blur()).
 *
 * Usage:
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8"></gk-point>
 * <gk-point lat="40.7128" lng="-74.0060" color="#ff0000" size="8" glow></gk-point>
 */

import {
  normalizeCoordinatesArray,
  isValidCoordinate,
} from '@local-hosting/geokit/core/coordinates';
import { pointEl } from './point-el';

export interface PointOptions {
  lat: number;
  lng: number;
  color?: string;
  size?: number;
  opacity?: number;
  blur?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOpacity?: number;
  /** When true, show a halo/glow behind the point (default: false). */
  glow?: boolean;
  /** Glow color; defaults to the point color when not set. */
  glowColor?: string;
  glowOpacity?: number;
  glowBlur?: number;
  pointId?: string;
  pointName?: string;
}

import { PointSelectRuntime } from './point-select-runtime';
import {
  convert,
  ensureUsCrosswalkLoaded,
  GKPoint,
  GeoKind,
  isUsCrosswalkLoaded,
} from '@local-hosting/geokit/crosswalk';
import type { DMA } from '@local-hosting/geokit/core';
import {
  POINT_DMA_PROPERTY,
  POINT_DMA_REGION_PROPERTY,
} from '../../../utils/shared-points/point-dma';

export class PointAccessorsApi extends PointSelectRuntime {
  /**
   * Return this point as a GeoJSON Feature for parent gk-point-layer to aggregate.
   * Used when this gk-point is a child of gk-point-layer (shared layers).
   */
  getFeatureData(): GeoJSON.Feature | null {
    const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
    const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');
    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate([lat, lng])) return null;
    const normalized = normalizeCoordinatesArray([[lng, lat]], 'lonlat', 'auto');
    const [normLng, normLat] = normalized[0];
    const pointId = pointEl(this)._propPointId ?? pointEl(this).safeGetAttribute('point-id');
    const pointName = pointEl(this)._propPointName ?? pointEl(this).safeGetAttribute('point-name');
    const featureId = pointId ?? `point-${pointEl(this).sourceId ?? crypto.randomUUID()}`;
    let properties: Record<string, unknown> = {
      color: pointEl(this).color,
      size: pointEl(this).size,
      'point-id': featureId,
      ...(pointId && { id: pointId }),
      ...(pointName && { 'point-name': pointName }),
    };
    if (isUsCrosswalkLoaded()) {
      const dma = convert(GKPoint(normLat, normLng), GeoKind.DMA);
      if (dma) {
        properties = {
          ...properties,
          [POINT_DMA_PROPERTY]: dma.slug,
          ...(dma.region ? { [POINT_DMA_REGION_PROPERTY]: dma.region } : {}),
        };
      }
    }
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [normLng, normLat] },
      properties,
    };
  }

  /** Nielsen DMA at this point (loads crosswalk when needed). */
  async resolveDma(): Promise<DMA | null> {
    const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
    const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');
    if (isNaN(lat) || isNaN(lng)) return null;
    await ensureUsCrosswalkLoaded();
    return convert(GKPoint(lat, lng), GeoKind.DMA) ?? null;
  }

  updatePosition(lat: number, lng: number): void {
    pointEl(this)._propLat = lat;
    pointEl(this)._propLng = lng;
    pointEl(this).safeSetAttribute('lat', lat.toString());
    pointEl(this).safeSetAttribute('lng', lng.toString());
  }

  updateStyle(color?: string, size?: number, opacity?: number): void {
    if (color !== undefined) {
      pointEl(this)._propColor = color;
      pointEl(this).safeSetAttribute('color', color);
    }
    if (size !== undefined) {
      pointEl(this)._propSize = size;
      pointEl(this).safeSetAttribute('size', size.toString());
    }
    if (opacity !== undefined) {
      pointEl(this)._propOpacity = opacity;
      pointEl(this).safeSetAttribute('opacity', opacity.toString());
    }
  }

  /**
   * Factory method to create and configure a point element
   * @param options - Point configuration options
   * @returns Configured point element
   */
}
