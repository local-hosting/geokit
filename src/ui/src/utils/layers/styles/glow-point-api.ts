/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../../../providers/types';
import type { Feature } from '@twinfile/geokit/core/types';
import { getFeatureId } from '@twinfile/geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../map-surface/theme';
import { debug } from '../../map-surface/logger';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../map-surface/feature-state-hover';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
} from '../../paint/shared-point-paint';
import { resolveSharedPointLayerIdForSource } from '../../shared-points/shared-point-heal';

// ============================================================================
// Types
// ============================================================================

import type { SharedPointLayersConfig } from './types';
import { createSharedPointLayers, EMPTY_GEOJSON, type GeoJSONSourceWithSetData } from './shared-point-layers';
import { getHoverGlowRadiusInterpolation, getPointRadiusInterpolation } from './circle-glow';
import { GLOW_HIT_PADDING_PX, HOVER_GLOW_PADDING_PX, offsetRadiusInterpolation } from './category-expressions';
import { resolveDefaultLayerColor, resolveGlowBlur, resolveSharedGlowColor } from './types';
export function createSharedPointLayersWithHover(
  config: SharedPointLayersConfig & { promoteId: string }
): HoverStateHandlers {
  createSharedPointLayers({ ...config, useFeatureStateHover: false });
  const {
    map,
    sourceId,
    promoteId: _promoteId,
    glowLayerId,
    pointLayerId,
    circleColor,
    glowColor,
    glowRadius,
    glowBlur,
    glowHoverOpacity,
  } = config;

  const hoverSourceId = `${sourceId}-hover`;
  const hoverLayerId = `${glowLayerId}-hover`;

  if (!map.getSource?.(hoverSourceId)) {
    try {
      map.addSource(hoverSourceId, {
        type: 'geojson',
        data: EMPTY_GEOJSON,
      });
      debug.log('[layer-styles] hover source ADD', { hoverSourceId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover source ${hoverSourceId}:`, err);
    }
  }

  // Add hover glow layer with larger radius for visual feedback
  // Uses HOVER_CONFIG from feature-state-hover.ts as source of truth
  if (map.getSource?.(hoverSourceId) && !map.getLayer?.(hoverLayerId)) {
    // If custom glowRadius provided, scale it; otherwise use default with hover scale
    const glowRadiusVal = glowRadius
      ? offsetRadiusInterpolation(
          glowRadius as unknown[],
          HOVER_GLOW_PADDING_PX - GLOW_HIT_PADDING_PX
        )
      : getHoverGlowRadiusInterpolation();
    const glowColorVal = resolveSharedGlowColor(glowColor, circleColor);
    const glowBlurVal = glowBlur ?? resolveGlowBlur();
    const hoverOpacity =
      typeof glowHoverOpacity === 'number' ? glowHoverOpacity : HOVER_CONFIG.glowOpacity;
    try {
      map.addLayer(
        {
          id: hoverLayerId,
          type: 'circle',
          source: hoverSourceId,
          layout: { visibility: 'visible' },
          paint: {
            'circle-radius': glowRadiusVal,
            'circle-color': glowColorVal,
            'circle-opacity': hoverOpacity,
            'circle-blur': glowBlurVal,
          },
        } as any,
        pointLayerId
      );
      debug.log('[layer-styles] hover glow layer ADD', { hoverLayerId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover layer ${hoverLayerId}:`, err);
    }
  }

  // Add hover point layer on top for brighter point effect
  // Uses HOVER_CONFIG from feature-state-hover.ts as source of truth
  const hoverPointLayerId = `${pointLayerId}-hover`;
  if (map.getSource?.(hoverSourceId) && !map.getLayer?.(hoverPointLayerId)) {
    const pointRadiusVal = getPointRadiusInterpolation({ scale: 1 });
    const pointColorVal = circleColor ?? resolveDefaultLayerColor();
    try {
      map.addLayer({
        id: hoverPointLayerId,
        type: 'circle',
        source: hoverSourceId,
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': pointRadiusVal,
          'circle-color': pointColorVal,
          'circle-opacity': HOVER_CONFIG.pointOpacity,
          'circle-blur': 0,
          'circle-stroke-width': 0,
        },
      } as any);
      debug.log('[layer-styles] hover point layer ADD', { hoverPointLayerId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover point layer ${hoverPointLayerId}:`, err);
    }
  }

  function setCursor(cursor: string): void {
    const canvas = map?.getCanvas?.();
    const style = canvas?.style as
      | { setProperty?(property: string, value: string, priority?: string): void; cursor?: string }
      | undefined;
    if (style?.setProperty) {
      style.setProperty('cursor', cursor, 'important');
    } else if (style) {
      style.cursor = cursor;
    }
  }

  function setHoverData(data: GeoJSON.FeatureCollection | GeoJSON.Feature): void {
    const source = map?.getSource?.(hoverSourceId) as GeoJSONSourceWithSetData | undefined;
    if (source?.setData) {
      try {
        source.setData(data);
      } catch {
        // ignore
      }
    }
  }

  function onMouseEnter(e: {
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
  }): void {
    const features = e?.features;
    if (!features?.length) {
      setHoverData(EMPTY_GEOJSON);
      setCursor('');
      return;
    }
    setCursor('pointer');
    const f = features[0];
    const geometry = f?.geometry;
    if (!geometry) {
      setHoverData(EMPTY_GEOJSON);
      return;
    }
    const feature: GeoJSON.Feature = {
      type: 'Feature',
      geometry: geometry as GeoJSON.Geometry,
      properties: { ...(f.properties || {}) },
    };
    setHoverData({ type: 'FeatureCollection', features: [feature] });
  }

  function onMouseLeave(): void {
    setHoverData(EMPTY_GEOJSON);
    setCursor('');
  }

  return { onMouseEnter, onMouseLeave };
}

/**
 * Remove glow + point layers created by createGlowPointLayers
 *
 * @param map - Map instance
 * @param layerPrefix - Same prefix used when creating layers
 */
export function removeGlowPointLayers(map: MapInstance, layerPrefix: string): void {
  const glowLayerId = `${layerPrefix}-glow`;
  const pointLayerId = `${layerPrefix}-points`;

  try {
    if (map.getLayer?.(pointLayerId)) {
      map.removeLayer(pointLayerId);
    }
    if (map.getLayer?.(glowLayerId)) {
      debug.log('[layer-styles] glow layer REMOVE (removeGlowPointLayers)', {
        where: 'layer-styles.ts removeGlowPointLayers',
        when: 'before removeLayer',
        glowLayerId,
        layerPrefix,
      });
      map.removeLayer(glowLayerId);
      debug.log('[layer-styles] glow layer REMOVE done', { glowLayerId });
    }
  } catch (error) {
    console.error(`[gk-layer-styles] Failed to remove layers for ${layerPrefix}:`, error);
  }
}

/**
 * Update visibility for glow + point layers
 *
 * @param map - Map instance
 * @param layerPrefix - Same prefix used when creating layers
 * @param visible - Whether layers should be visible
 */
export function setGlowPointLayersVisibility(
  map: MapInstance,
  layerPrefix: string,
  visible: boolean
): void {
  const glowLayerId = `${layerPrefix}-glow`;
  const pointLayerId = `${layerPrefix}-points`;
  const visibility = visible ? 'visible' : 'none';

  try {
    if (map.getLayer?.(glowLayerId) && map.setLayoutProperty) {
      map.setLayoutProperty(glowLayerId, 'visibility', visibility);
    }
    if (map.getLayer?.(pointLayerId) && map.setLayoutProperty) {
      map.setLayoutProperty(pointLayerId, 'visibility', visibility);
    }
  } catch (error) {
    console.error(`[gk-layer-styles] Failed to set visibility for ${layerPrefix}:`, error);
  }
}

/**
 * Update filter for glow + point layers
 *
 * @param map - Map instance
 * @param layerPrefix - Same prefix used when creating layers
 * @param filter - Filter expression (null to remove filter)
 */
export function setGlowPointLayersFilter(
  map: MapInstance,
  layerPrefix: string,
  filter: unknown[] | null
): void {
  const glowLayerId = `${layerPrefix}-glow`;
  const pointLayerId = `${layerPrefix}-points`;
  const filterExpr = filter || ['literal', true];

  // Use type assertion for setFilter since it's a common MapLibre method
  // but not in our minimal MapInstance interface
  const mapWithFilter = map as MapInstance & {
    setFilter?: (layerId: string, filter: unknown) => void;
  };

  try {
    if (map.getLayer?.(glowLayerId) && mapWithFilter.setFilter) {
      mapWithFilter.setFilter(glowLayerId, filterExpr);
    }
    if (map.getLayer?.(pointLayerId) && mapWithFilter.setFilter) {
      mapWithFilter.setFilter(pointLayerId, filterExpr);
    }
  } catch (error) {
    console.error(`[gk-layer-styles] Failed to set filter for ${layerPrefix}:`, error);
  }
}
