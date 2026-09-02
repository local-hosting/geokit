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

import type { CircleStyleOptions, CircleLayerConfig, GlowPointLayerConfig } from './types';
import {
  MIN_POINT_RADIUS_PX, GLOW_HIT_PADDING_PX, HOVER_GLOW_PADDING_PX,
  offsetRadiusInterpolation, scaleRadiusInterpolation, defaultScaleFromMatchExpression,
} from './category-expressions';
import {
  resolveDefaultStrokeColor, resolveGlowBlur, resolveGlowOpacity,
  resolvePointOpacity, resolveSharedGlowColor, resolveDefaultLayerColor,
} from './types';
export function getPointRadiusInterpolation(options: CircleStyleOptions = {}): unknown[] {
  const { scale = 1, exponent = 1.5, minRadiusPx = MIN_POINT_RADIUS_PX } = options;
  // Point radius never below 2px so Safari reliably renders when zoomed out (1px can vanish)
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    0,
    Math.max(minRadiusPx, 1.2 * scale),
    2,
    Math.max(minRadiusPx, 1.4 * scale),
    3,
    Math.max(minRadiusPx, 1.75 * scale),
    6,
    2.8 * scale, // Country view
    8,
    3.65 * scale, // Regional view (medium zoom)
    10,
    4.35 * scale, // City view
    14,
    6 * scale, // Neighborhood
    18,
    9 * scale, // Max zoom
  ];
}

/**
 * Get zoom-based radius interpolation for glow/hit-area layers
 * Slightly larger than point radius for visual effect and click detection
 *
 * @param options - Style options (scale, exponent)
 * @returns MapLibre interpolation expression
 */
export function getGlowRadiusInterpolation(options: CircleStyleOptions = {}): unknown[] {
  return offsetRadiusInterpolation(getPointRadiusInterpolation(options), GLOW_HIT_PADDING_PX);
}

/**
 * Hover glow radius: slightly larger than base glow, still derived from point size.
 */
export function getHoverGlowRadiusInterpolation(options: CircleStyleOptions = {}): unknown[] {
  return offsetRadiusInterpolation(getPointRadiusInterpolation(options), HOVER_GLOW_PADDING_PX);
}

/** Selection ring stroke width (px); keep in sync with setupSelectionRingLayer paint. */
export const SELECTION_RING_STROKE_WIDTH = 2;

/** Clear space between point edge and ring inner edge (px). */
export const SELECTION_RING_GAP_PX = 0.5;

/**
 * Get zoom-based radius for selection ring: point radius + outline stroke + gap + half ring stroke.
 * MapLibre draws circle-stroke outside circle-radius; the ring must clear the outline edge.
 *
 * @param options - Style options (scale, exponent)
 * @param pointStrokeWidth - Point outline width (px or expression); default 0
 * @returns MapLibre expression
 */
export function getShadowRadiusInterpolation(options: CircleStyleOptions = {}): unknown[] {
  const { scale = 1, exponent = 1.8 } = options;
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    3,
    3 * scale,
    5,
    4 * scale,
    7,
    7 * scale,
    9,
    11 * scale,
    11,
    16 * scale,
    13,
    24 * scale,
    15,
    34 * scale,
    17,
    46 * scale,
    19,
    60 * scale,
  ];
}

/**
 * Get zoom-based stroke width interpolation
 * Thinner at low zoom so the border doesn’t dominate small circles
 *
 * @param baseWidth - Base stroke width at mid zoom
 * @returns MapLibre interpolation expression
 */
export function getStrokeWidthInterpolation(baseWidth: number): unknown[] {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    Math.max(0.25, baseWidth * 0.2), // Zoomed out: thin stroke so border isn’t huge
    2,
    Math.max(0.35, baseWidth * 0.3),
    3,
    baseWidth * 0.5,
    10,
    baseWidth,
    18,
    baseWidth * 1.5,
  ];
}

// ============================================================================
// Helpers (SDK-safe: MapTiler/MapLibre coalesceChanges uses Object.keys etc.)
// ============================================================================

/**
 * Return a copy of the object with undefined and null omitted.
 * Root cause fix: MapTiler/MapLibre coalesceChanges does Object.keys/entries on
 * layer layout/paint; passing null/undefined throws "Cannot convert undefined or null to object".
 */
export function omitNil<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v != null) out[k] = v;
  }
  return out;
}

// ============================================================================
// Layer Specification Builders
// ============================================================================

/**
 * Create a circle layer specification
 * Returns a layer config object suitable for map.addLayer()
 *
 * @param config - Circle layer configuration
 * @returns MapLibre layer specification
 */
export function createCircleLayerSpec(config: CircleLayerConfig): Record<string, unknown> {
  const {
    id,
    source,
    color,
    radius,
    opacity = 1,
    strokeColor,
    strokeWidth = 0,
    strokeOpacity = 1,
    blur = 0,
    filter,
  } = config;

  const paint: Record<string, unknown> = {
    'circle-radius': radius || getPointRadiusInterpolation(),
    'circle-color': color,
    'circle-opacity': opacity,
    'circle-blur': blur,
  };

  if (strokeWidth && strokeWidth !== 0) {
    paint['circle-stroke-width'] = strokeWidth;
    paint['circle-stroke-color'] =
      strokeColor || resolveDefaultStrokeColor(document.documentElement);
    paint['circle-stroke-opacity'] = strokeOpacity;
  } else {
    paint['circle-stroke-width'] = 0;
  }

  const layerSpec: Record<string, unknown> = {
    id,
    type: 'circle',
    source,
    paint: omitNil(paint as Record<string, unknown>),
  };

  if (filter != null) {
    layerSpec.filter = filter;
  }

  return layerSpec;
}

// ============================================================================
// Layer Creation Utilities
// ============================================================================

/**
 * Create glow + point layer combo
 * Common pattern: semi-transparent glow layer below, solid point layer above
 *
 * The glow layer serves dual purposes:
 * 1. Visual: Subtle glow effect around points
 * 2. Functional: Larger hit area for click/hover detection
 *
 * @param config - Layer configuration
 * @returns Object with created layer IDs
 *
 * @example
 * ```ts
 * const { glowLayerId, pointLayerId } = createGlowPointLayers({
 *   map,
 *   sourceId: 'points',
 *   layerPrefix: 'site',
 *   color: resolveDefaultLayerColor(),
 * });
 * ```
 */
export function createGlowPointLayers(config: GlowPointLayerConfig): {
  glowLayerId: string;
  pointLayerId: string;
} {
  const {
    map,
    sourceId,
    layerPrefix,
    color,
    glowColor,
    glowOpacity,
    glowBlur,
    scale = 1,
    filter,
    beforeLayerId,
    strokeColor,
    strokeWidth = 0,
  } = config;
  const container = (map as any).getContainer?.();
  const themeElement =
    container && typeof container.closest === 'function' ? container.closest('gk-map') : null;
  const element = themeElement ?? document.documentElement;
  const resolvedGlowOpacity = glowOpacity ?? resolveGlowOpacity(element);
  const resolvedGlowBlur = glowBlur ?? resolveGlowBlur(element);
  const resolvedPointOpacity = resolvePointOpacity(element);

  const glowLayerId = `${layerPrefix}-glow`;
  const pointLayerId = `${layerPrefix}-points`;

  // Create glow layer (bottom)
  if (!map.getLayer?.(glowLayerId)) {
    debug.log('[layer-styles] glow layer ADD (createGlowPointLayers)', {
      where: 'layer-styles.ts createGlowPointLayers',
      when: 'before addLayer',
      glowLayerId,
      sourceId,
      beforeLayerId: beforeLayerId ?? undefined,
    });
    const glowSpec = createCircleLayerSpec({
      id: glowLayerId,
      source: sourceId,
      color: glowColor || color,
      radius: getGlowRadiusInterpolation({ scale }),
      opacity: resolvedGlowOpacity,
      blur: resolvedGlowBlur,
      filter,
    });

    try {
      if (beforeLayerId != null) {
        map.addLayer(glowSpec as any, beforeLayerId);
      } else {
        map.addLayer(glowSpec as any);
      }
      debug.log('[layer-styles] glow layer ADD done', { glowLayerId });
    } catch (error) {
      console.error(`[gk-layer-styles] Failed to add glow layer ${glowLayerId}:`, error);
    }
  }

  // Create point layer (top)
  if (!map.getLayer?.(pointLayerId)) {
    const pointSpec = createCircleLayerSpec({
      id: pointLayerId,
      source: sourceId,
      color,
      radius: getPointRadiusInterpolation({ scale }),
      opacity: resolvedPointOpacity,
      strokeColor,
      strokeWidth: strokeWidth > 0 ? getStrokeWidthInterpolation(strokeWidth) : 0,
      filter,
    });

    try {
      if (beforeLayerId != null) {
        map.addLayer(pointSpec as any, beforeLayerId);
      } else {
        map.addLayer(pointSpec as any);
      }
    } catch (error) {
      console.error(`[gk-layer-styles] Failed to add point layer ${pointLayerId}:`, error);
    }
  }

  return { glowLayerId, pointLayerId };
}

/**
 * Create shared glow + point layers with explicit layer IDs and full paint control.
 * More flexible than createGlowPointLayers - allows data-driven expressions for all properties.
 *
 * IMPORTANT – MapTiler SDK point layer: MapTiler SDK can fail to render the point (circle)
 * layer when it uses many or complex data-driven expressions (e.g. we observed DOTS=0 with
 * full expressions while GLOW rendered). To avoid this:
 * - Use only a minimal set of expressions on the point layer: circle-color (data-driven) and
 *   circle-radius (zoom interpolation) are known to work; keep circle-opacity and circle-blur
 *   static (e.g. 1 and 0).
 * - Always add the point layer without beforeLayerId so it draws on top of the glow.
 * - Keep a static-paint fallback so dots still appear if addLayer throws.
 *
 * @param config - Layer configuration with explicit IDs and paint expressions
 */
/** Zoom–radius stops for MapTiler helpers.addPoint. Min 2px at low zoom so Safari doesn't drop points when zoomed out. */
const MAPTILER_POINT_RADIUS_ZOOM: Array<{ zoom: number; value: number }> = [
  { zoom: 0, value: 3 },
  { zoom: 2, value: 3 },
  { zoom: 6, value: 2.8 },
  { zoom: 10, value: 4.35 },
  { zoom: 14, value: 6 },
  { zoom: 18, value: 9 },
];

function maptilerPointRadiusInterpolation(): unknown[] {
  const expr: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const stop of MAPTILER_POINT_RADIUS_ZOOM) {
    expr.push(stop.zoom, stop.value);
  }
  return expr;
}

function resolveEffectivePointRadius(
  pointRadius: unknown | undefined,
  usedMapTilerHelper: boolean
): unknown {
  if (pointRadius !== undefined) return pointRadius;
  if (usedMapTilerHelper) return maptilerPointRadiusInterpolation();
  return getPointRadiusInterpolation();
}

/** Ring radius derived from the point layer's circle-radius (static or data-driven). */
