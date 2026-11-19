/**
 * Point layer creation: add source + glow, shadow, hover, main circle layers (Single Responsibility)
 */

import { getCSSVariable, getCSSVariableNumber } from '../../../utils/theme';
import { HOVER_CONFIG } from '../../../utils/feature-state-hover';
import { debug } from '../../../utils/logger';
import { POINT_GEOJSON_SOURCE_OPTIONS } from '../../../utils/geojson-source-options';
import {
  getZoomRadiusExpression,
  getShadowRadiusExpression,
  getGlowRadiusExpression,
  getHoverGlowRadiusExpression,
} from './point-style';

export type PointMapLike = {
  addSource: (
    id: string,
    spec: { type: string; data: GeoJSON.FeatureCollection; promoteId?: string }
  ) => void;
  addLayer: (
    spec: Record<string, unknown> & {
      id: string;
      type: string;
      source: string;
      paint?: Record<string, unknown>;
    },
    beforeId?: string
  ) => void;
};

export interface PointLayersOptions {
  map: PointMapLike;
  mapElement: HTMLElement | null;
  sourceId: string;
  layerId: string;
  shadowLayerId: string | null;
  glowLayerId: string | null;
  hoverSourceId: string | null;
  hoverLayerId: string | null;
  size: number;
  color: string;
  opacity: number;
  pointBlur: number;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity: number;
  glow: boolean;
  glowColor: string;
  glowOpacity: number;
  glowBlur: number;
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
}

/**
 * Add point source and all circle layers (glow, shadow, hover, main). Caller owns layer IDs and style values.
 */
export function createPointLayers(
  opts: PointLayersOptions,
  pointData: GeoJSON.FeatureCollection
): void {
  const {
    map,
    mapElement,
    sourceId,
    layerId,
    shadowLayerId,
    glowLayerId,
    hoverSourceId,
    hoverLayerId,
    size,
    color,
    opacity,
    pointBlur,
    strokeWidth,
    strokeColor,
    strokeOpacity,
    glow,
    glowColor,
    glowOpacity,
    glowBlur,
    shadow,
    shadowColor,
    shadowOpacity,
    shadowBlur,
  } = opts;

  try {
    map.addSource(sourceId, {
      type: 'geojson',
      data: pointData,
      promoteId: 'point-id',
      ...POINT_GEOJSON_SOURCE_OPTIONS,
    });
  } catch (error) {
    console.error('[gk-point] Failed to add source:', error);
    return;
  }

  const emptyHover: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
  if (hoverSourceId) {
    try {
      map.addSource(hoverSourceId, {
        type: 'geojson',
        data: emptyHover,
        ...POINT_GEOJSON_SOURCE_OPTIONS,
      });
    } catch (error) {
      console.error('[gk-point] Failed to add hover source:', error);
    }
  }

  if (glow && glowLayerId) {
    debug.log(' glow layer ADD (createPointLayers)', {
      where: 'point-layers.ts',
      glowLayerId,
      sourceId,
    });
    try {
      map.addLayer({
        id: glowLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': getGlowRadiusExpression(size),
          'circle-color': glowColor,
          'circle-opacity': glowOpacity,
          'circle-blur': glowBlur,
        },
      });
    } catch (error) {
      console.error('[gk-point] Failed to add glow layer:', error);
    }
  }

  if (shadow && shadowLayerId) {
    try {
      map.addLayer({
        id: shadowLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': getShadowRadiusExpression(size),
          'circle-color': shadowColor,
          'circle-opacity': shadowOpacity,
          'circle-blur': shadowBlur,
        },
      });
    } catch (error) {
      console.error('[gk-point] Failed to add shadow layer:', error);
    }
  }

  const paint: Record<string, unknown> = {
    'circle-radius': getZoomRadiusExpression(size),
    'circle-color': color,
    'circle-opacity': opacity,
    'circle-blur': pointBlur,
  };
  if (strokeWidth > 0) {
    paint['circle-stroke-width'] = strokeWidth;
    paint['circle-stroke-color'] = strokeColor;
    paint['circle-stroke-opacity'] = strokeOpacity;
  } else {
    paint['circle-stroke-width'] = 0;
  }

  try {
    map.addLayer({
      id: layerId,
      type: 'circle',
      source: sourceId,
      paint,
    });
    debug.log(' createPointLayers main layer', { layerId });
  } catch (error) {
    console.error('[gk-point] Failed to add main layer:', error);
    return;
  }

  const el = mapElement ?? document.documentElement;
  const hoverOpacity = getCSSVariableNumber(
    el,
    '--gk-point-glow-hover-opacity',
    HOVER_CONFIG.glowOpacity
  );
  const hoverBlur = getCSSVariableNumber(el, '--gk-glow-blur', 0.8);
  const hoverColor = getCSSVariable(el, '--gk-point-glow-color', glowColor) || glowColor;

  if (hoverLayerId && hoverSourceId) {
    try {
      map.addLayer(
        {
          id: hoverLayerId,
          type: 'circle',
          source: hoverSourceId,
          paint: {
            'circle-radius': getHoverGlowRadiusExpression(size),
            'circle-color': hoverColor,
            'circle-opacity': hoverOpacity,
            'circle-blur': hoverBlur,
          },
        },
        layerId
      );
    } catch (error) {
      console.error('[gk-point] Failed to add hover layer:', error);
    }
  }

  if (hoverLayerId && hoverSourceId) {
    const hoverPointLayerId = `${hoverLayerId}-point`;
    try {
      map.addLayer({
        id: hoverPointLayerId,
        type: 'circle',
        source: hoverSourceId,
        paint: {
          'circle-radius': getZoomRadiusExpression(size),
          'circle-color': color,
          'circle-opacity': HOVER_CONFIG.pointOpacity,
          'circle-blur': 0,
          'circle-stroke-width': HOVER_CONFIG.pointStrokeWidth,
          'circle-stroke-color': HOVER_CONFIG.pointStrokeColor,
        },
      });
    } catch (error) {
      console.error('[gk-point] Failed to add hover point layer:', error);
    }
  }

  debug.log(' createPointLayers done', { layerId });
}
