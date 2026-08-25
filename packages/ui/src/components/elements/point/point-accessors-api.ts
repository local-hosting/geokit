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

import { MapChildElement } from '../../map-child-element';
import {
  extractPointLngLat,
  normalizeCoordinatesArray,
  isValidCoordinate,
} from '@geokit/core/coordinates';
import type { MapEvent, MapRenderedFeature } from '../../../providers/types';
import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { createGeokitLogger } from '../../../utils/logger';
import { PopupElement } from '../popup/popup';
import { readFirstPointCoordinatesFromGeoJsonSource } from '../../../utils/geojson-source-options';
import { applyPointPaintProperties } from './point-style';
import { createPointLayers as createPointLayersFn, type PointMapLike } from './point-layers';
import {
  applySelectedVisual as applySelectedVisualFn,
  clearSelectedVisual,
} from './point-selection';

import { pointEl } from './point-el';
const { debug } = createGeokitLogger('point');

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
} from '@geokit/crosswalk';
import type { DMA } from '@geokit/core';
import {
  POINT_DMA_PROPERTY,
  POINT_DMA_REGION_PROPERTY,
} from '../../../utils/shared-points/point-dma';

export class PointAccessorsApi extends PointSelectRuntime {
  get color(): string {
    return (
      pointEl(this)._propColor ??
      pointEl(this).safeGetAttribute('color') ??
      getCSSVariable(pointEl(this).mapElement, '--gk-point-color', '')
    );
  }

  get size(): number {
    if (pointEl(this)._propSize !== undefined) return pointEl(this)._propSize;
    return parseInt(pointEl(this).safeGetAttribute('size') || '6') || 6;
  }

  get opacity(): number {
    if (pointEl(this)._propOpacity !== undefined) return pointEl(this)._propOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('opacity') || '1.0') || 1.0;
  }

  get pointBlur(): number {
    if (pointEl(this)._propBlur !== undefined) return pointEl(this)._propBlur;
    return parseFloat(pointEl(this).safeGetAttribute('blur') || '0') || 0;
  }

  get strokeColor(): string {
    return (
      pointEl(this)._propStrokeColor ??
      pointEl(this).safeGetAttribute('stroke-color') ??
      getCSSVariable(pointEl(this).mapElement, '--gk-point-stroke-color', '')
    );
  }

  get strokeWidth(): number {
    if (pointEl(this)._propStrokeWidth !== undefined) return pointEl(this)._propStrokeWidth;
    const strokeWidth = pointEl(this).safeGetAttribute('stroke-width');
    if (strokeWidth === null || strokeWidth === undefined) return 0;
    const parsed = parseFloat(strokeWidth);
    return isNaN(parsed) ? 0 : parsed;
  }

  get strokeOpacity(): number {
    if (pointEl(this)._propStrokeOpacity !== undefined) return pointEl(this)._propStrokeOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('stroke-opacity') || '0.8') || 0.8;
  }

  get shadow(): boolean {
    if (pointEl(this)._propShadow !== undefined) return pointEl(this)._propShadow;
    const shadowAttr = pointEl(this).safeGetAttribute('shadow');
    return shadowAttr !== null && shadowAttr !== 'false';
  }

  get shadowColor(): string {
    return (
      pointEl(this)._propShadowColor ??
      pointEl(this).safeGetAttribute('shadow-color') ??
      getCSSVariable(pointEl(this).mapElement, '--gk-point-shadow-color', '')
    );
  }

  get shadowBlur(): number {
    if (pointEl(this)._propShadowBlur !== undefined) return pointEl(this)._propShadowBlur;
    return parseFloat(pointEl(this).safeGetAttribute('shadow-blur') || '0.8') || 0.8;
  }

  get shadowOpacity(): number {
    if (pointEl(this)._propShadowOpacity !== undefined) return pointEl(this)._propShadowOpacity;
    return parseFloat(pointEl(this).safeGetAttribute('shadow-opacity') || '0.4') || 0.4;
  }

  get glow(): boolean {
    if (pointEl(this)._propGlow !== undefined) return pointEl(this)._propGlow;
    const glowAttr = pointEl(this).safeGetAttribute('glow');
    // Optional: off by default; on when glow, glow="true", or glow=""
    if (glowAttr === null) return false;
    return glowAttr !== 'false';
  }

  /** Glow halo color; defaults to the point color when not set. */
  get glowColor(): string {
    return pointEl(this)._propGlowColor ?? pointEl(this).safeGetAttribute('glow-color') ?? pointEl(this).color;
  }

  get glowOpacity(): number {
    if (pointEl(this)._propGlowOpacity !== undefined) return pointEl(this)._propGlowOpacity;
    const attrValue = pointEl(this).safeGetAttribute('glow-opacity');
    if (attrValue) return parseFloat(attrValue) || 0;
    return getCSSVariableNumber(pointEl(this).mapElement, '--gk-point-glow-opacity', 0);
  }

  get glowBlur(): number {
    if (pointEl(this)._propGlowBlur !== undefined) return pointEl(this)._propGlowBlur;
    return (
      parseFloat(pointEl(this).safeGetAttribute('glow-blur') || '') ||
      getCSSVariableNumber(pointEl(this).mapElement, '--gk-glow-blur', 0)
    );
  }

  // Public API

  /**
   * Select the point (shows ring + shadow). Same as setting selected attribute. focus() name kept for API familiarity.
   */
  public focus(): void {
    if (!pointEl(this).map || !pointEl(this).sourceId) return;

    const lat = pointEl(this)._propLat ?? parseFloat(pointEl(this).safeGetAttribute('lat') || '');
    const lng = pointEl(this)._propLng ?? parseFloat(pointEl(this).safeGetAttribute('lng') || '');
    if (isNaN(lat) || isNaN(lng)) return;

    const fallback: GeoJSON.Feature = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    };
    const feature = pointEl(this).canonicalPointFeature(fallback);
    if (!feature) return;

    pointEl(this).setHoverAt(null);
    pointEl(this).applySelectedVisual(feature);
  }

  /** Whether the point is selected (ring visible). */
  get selected(): boolean {
    return pointEl(this).selectedLayers != null;
  }

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
