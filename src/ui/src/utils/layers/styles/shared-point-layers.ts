/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../../../providers/types';
import type { Feature } from '@geokit/core/types';
import { getFeatureId } from '@geokit/core/geojson';
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

import type { SharedPointLayersConfig, CircleStyleOptions } from './types';
import {
  getPointRadiusInterpolation, getGlowRadiusInterpolation, SELECTION_RING_STROKE_WIDTH, SELECTION_RING_GAP_PX,
} from './circle-glow';
import { offsetRadiusInterpolation } from './category-expressions';
import { omitNil } from './circle-glow';
import {
  resolveGlowBlur, resolveGlowOpacity, resolveSharedGlowColor, resolveDefaultLayerColor, resolveDefaultStrokeColor,
} from './types';

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
export function getSelectionRingRadiusFromPointRadius(
  pointRadius: unknown,
  pointStrokeWidth: unknown = 0
): unknown {
  const gapAndRing = SELECTION_RING_GAP_PX + SELECTION_RING_STROKE_WIDTH / 2;
  const stroke = pointStrokeWidth === undefined || pointStrokeWidth === 0 ? 0 : pointStrokeWidth;

  // Static outline: bake full offset into interpolate stops (MapTiler-safe).
  if (typeof stroke === 'number') {
    const offset = gapAndRing + stroke;
    if (typeof pointRadius === 'number') return pointRadius + offset;
    if (Array.isArray(pointRadius) && pointRadius[0] === 'interpolate') {
      return offsetRadiusInterpolation(pointRadius, offset);
    }
    if (Array.isArray(pointRadius)) return ['+', pointRadius, offset];
    return offsetRadiusInterpolation(getPointRadiusInterpolation(), offset);
  }

  // Data-driven outline: gap+ring in stops; add per-feature stroke on the ring layer.
  if (typeof pointRadius === 'number') {
    return ['+', pointRadius + gapAndRing, stroke];
  }
  if (Array.isArray(pointRadius) && pointRadius[0] === 'interpolate') {
    return ['+', offsetRadiusInterpolation(pointRadius, gapAndRing), stroke];
  }
  if (Array.isArray(pointRadius)) {
    return ['+', ['+', pointRadius, gapAndRing], stroke];
  }
  return ['+', offsetRadiusInterpolation(getPointRadiusInterpolation(), gapAndRing), stroke];
}


export function getSelectionRingRadiusInterpolation(
  options: CircleStyleOptions = {},
  pointStrokeWidth: unknown = 0
): unknown[] {
  return getSelectionRingRadiusFromPointRadius(
    getPointRadiusInterpolation(options),
    pointStrokeWidth
  ) as unknown[];
}

/**
 * Get zoom-based radius interpolation for shadow layers
 * Larger than point for drop shadow effect
 *
 * @param options - Style options (scale, exponent)
 * @returns MapLibre interpolation expression
 */
function resolveSharedPointFeatureStateHoverPaint(
  useFeatureStateHover: boolean,
  glowRadius: unknown[],
  glowOpacity: number | unknown[],
  glowHoverOpacity: number | unknown[],
  circleOpacity: number | unknown[]
) {
  if (!useFeatureStateHover || Array.isArray(glowOpacity)) {
    return null;
  }

  const numGlowOpacity = typeof glowOpacity === 'number' ? glowOpacity : resolveGlowOpacity();
  const numGlowHoverOpacity =
    typeof glowHoverOpacity === 'number' ? glowHoverOpacity : HOVER_CONFIG.glowOpacity;
  const numPointOpacity = typeof circleOpacity === 'number' ? circleOpacity : 1;

  return buildSharedPointFeatureStateHoverPaint({
    glowRadius,
    glowOpacity: numGlowOpacity,
    pointOpacity: numPointOpacity,
    glowHoverOpacity: numGlowHoverOpacity,
  });
}

/**
 * Create GK point shared layers: one source, glow layer, and point layer for many features.
 * Layers use feature-state (hover/selected) so apps can wire hover via createHoverStateHandlers
 * or createSharedPointLayersWithHover. This is the GK point pattern for many points from one source.
 */
type SharedPointGlowLayerConfig = {
  map: MapInstance;
  sourceId: string;
  glowLayerId: string;
  pointLayerId: string;
  baseGlowRadius: unknown[] | number;
  resolvedGlowColor: string | unknown[];
  glowBlur: number | undefined;
  hoverPaint: ReturnType<typeof resolveSharedPointFeatureStateHoverPaint>;
  glowOpacity: number | unknown[] | undefined;
  filter?: unknown[];
  beforeLayerId?: string;
};


function whenMapLayerExists(
  map: MapInstance,
  layerId: string,
  fn: () => void,
  maxAttempts = 60
): void {
  if (map.getLayer?.(layerId)) {
    fn();
    return;
  }

  let attempts = 0;
  const tryRun = () => {
    attempts += 1;
    if (map.getLayer?.(layerId)) {
      fn();
      return;
    }
    if (attempts >= maxAttempts) return;
    if (typeof map.once === 'function') {
      map.once('idle', tryRun);
      return;
    }
    setTimeout(tryRun, 16);
  };

  tryRun();
}

function addSharedPointGlowLayer(config: SharedPointGlowLayerConfig): boolean {
  const {
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    baseGlowRadius,
    resolvedGlowColor,
    glowBlur,
    hoverPaint,
    glowOpacity,
    filter,
    beforeLayerId,
  } = config;

  if (map.getLayer?.(glowLayerId)) return true;

  const glowRadiusVal = baseGlowRadius;
  const glowColorVal = resolvedGlowColor;
  const glowBlurVal = glowBlur ?? resolveGlowBlur();
  let glowOpacityExpression: unknown[] | number;
  if (hoverPaint) {
    glowOpacityExpression = hoverPaint.glowOpacity;
  } else if (Array.isArray(glowOpacity)) {
    glowOpacityExpression = glowOpacity;
  } else {
    glowOpacityExpression = typeof glowOpacity === 'number' ? glowOpacity : resolveGlowOpacity();
  }

  const glowPaint: Record<string, unknown> = {
    'circle-radius': hoverPaint?.glowRadius ?? glowRadiusVal,
    'circle-color': glowColorVal,
    'circle-opacity': glowOpacityExpression,
    'circle-blur': glowBlurVal,
  };
  const glowLayerSpec: Record<string, unknown> = {
    id: glowLayerId,
    type: 'circle',
    source: sourceId,
    minzoom: 0,
    layout: { visibility: 'visible' },
    paint: omitNil(glowPaint),
  };
  if (filter != null) glowLayerSpec.filter = filter;

  try {
    if (map.getLayer?.(pointLayerId)) {
      map.addLayer(glowLayerSpec as any, pointLayerId);
    } else if (beforeLayerId != null) {
      map.addLayer(glowLayerSpec as any, beforeLayerId);
    } else {
      map.addLayer(glowLayerSpec as any);
    }
    debug.log('[layer-styles] glow layer ADD done', { glowLayerId });
    return !!map.getLayer?.(glowLayerId);
  } catch (error) {
    console.error(`[gk-layer-styles] Failed to add glow layer ${glowLayerId}:`, error);
    return false;
  }
}

function finishSharedPointHelperLayerSet(
  config: SharedPointLayersConfig,
  ctx: {
    baseGlowRadius: unknown[] | number;
    resolvedGlowColor: string | unknown[];
    hoverPaint: ReturnType<typeof resolveSharedPointFeatureStateHoverPaint>;
  }
): boolean {
  const {
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    glowOpacity,
    glowBlur,
    glowHoverOpacity,
    filter,
    beforeLayerId,
    pointRadius,
    circleColor,
    selectionRingColor = '#ffffff',
    selectionShadowColor,
    selectionPointStrokeWidth = 0,
    circleStrokeWidth: _circleStrokeWidth,
  } = config;
  const { baseGlowRadius, resolvedGlowColor, hoverPaint } = ctx;

  const glowAdded = addSharedPointGlowLayer({
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    baseGlowRadius,
    resolvedGlowColor,
    glowBlur,
    hoverPaint,
    glowOpacity,
    filter,
    beforeLayerId,
  });
  if (!glowAdded) return false;

  const effectivePointRadius = resolveEffectivePointRadius(pointRadius, true);
  if (pointRadius === undefined && map.setPaintProperty) {
    try {
      map.setPaintProperty(pointLayerId, 'circle-radius', effectivePointRadius as any);
    } catch (radiusErr) {
      console.warn(
        `[gk-layer-styles] setPaintProperty circle-radius failed for ${pointLayerId}:`,
        radiusErr
      );
    }
  }

  setupSelectionRingLayer(
    map,
    sourceId,
    pointLayerId,
    selectionRingColor,
    effectivePointRadius,
    selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
  );
  if (selectionShadowColor) {
    setupSelectionShadowLayer(
      map,
      sourceId,
      pointLayerId,
      selectionShadowColor,
      effectivePointRadius,
      selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
    );
  }

  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
    glowRadius: baseGlowRadius as unknown[],
    glowColor: resolvedGlowColor,
    glowBlur: glowBlur ?? resolveGlowBlur(),
    glowHoverOpacity,
    circleColor,
    pointRadius: effectivePointRadius,
  });
  return true;
}

export function createSharedPointLayers(config: SharedPointLayersConfig): void {
  const {
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    circleColor,
    circleOpacity: _circleOpacity,
    circleStrokeColor: _circleStrokeColor,
    circleStrokeWidth: _circleStrokeWidth,
    glowColor,
    glowOpacity,
    glowHoverOpacity,
    glowBlur,
    pointRadius,
    glowRadius,
    filter,
    beforeLayerId,
    useMapTilerPointHelper,
    geojson,
    promoteId,
    useFeatureStateHover = true,
    selectionRingColor = '#ffffff',
    selectionShadowColor,
    selectionPointStrokeWidth = 0,
  } = config;

  const container = (map as any).getContainer?.();
  const themeElement =
    container && typeof container.closest === 'function' ? container.closest('gk-map') : null;
  const resolvedGlowColor = resolveSharedGlowColor(glowColor, circleColor, themeElement);
  const baseGlowRadius = glowRadius ?? getGlowRadiusInterpolation({ scale: 1 });
  const hoverPaint = resolveSharedPointFeatureStateHoverPaint(
    useFeatureStateHover,
    baseGlowRadius,
    glowOpacity,
    glowHoverOpacity,
    _circleOpacity
  );

  const maptilerHelpers =
    typeof window !== 'undefined' ? (window as any).maptilersdk?.helpers : undefined;
  const useHelper =
    !!useMapTilerPointHelper &&
    !!geojson &&
    !!maptilerHelpers?.addPoint &&
    !map.getLayer?.(pointLayerId);

  let helperSucceeded = false;
  if (useHelper) {
    try {
      // Create source ourselves FIRST with promoteId so feature-state works (selection ring).
      // MapTiler's addPoint helper doesn't pass promoteId to the source it creates.
      // By creating the source before the helper runs, the helper will use our source.
      if (promoteId && geojson && !map.getSource?.(sourceId)) {
        // tolerance: 0 prevents geojson-vt from dropping points at low zoom
        map.addSource(sourceId, {
          type: 'geojson',
          data: geojson,
          promoteId,
          tolerance: 0,
        });
        debug.log('[layer-styles] source ADD with promoteId before helper', {
          sourceId,
          promoteId,
        });
      }

      // Helper only accepts a single color; we override with data-driven color after if needed
      const singleColor =
        typeof circleColor === 'string' ? circleColor : resolveDefaultLayerColor();
      maptilerHelpers.addPoint(map as any, {
        data: geojson,
        sourceId,
        layerId: pointLayerId,
        pointRadius: MAPTILER_POINT_RADIUS_ZOOM,
        pointColor: singleColor,
        pointOpacity: 1,
        showLabel: false,
        cluster: false,
      });
      debug.log('[layer-styles] point layer ADD via MapTiler helpers.addPoint', { pointLayerId });
      helperSucceeded = true;

      // Override minzoom - MapTiler helper may set a default that hides points when zoomed out
      const setPointLayerZoomRange = () => {
        if (typeof (map as any).setLayerZoomRange !== 'function') return;
        if (!(map as any).getLayer?.(pointLayerId)) return;
        try {
          (map as any).setLayerZoomRange(pointLayerId, 0, 24);
        } catch {
          // Ignore - some map implementations may not support this
        }
      };
      setPointLayerZoomRange();
      // Helper may add the layer asynchronously; retry on idle so points stay visible when zooming out
      if (!(map as any).getLayer?.(pointLayerId)) {
        const onIdle = () => {
          setPointLayerZoomRange();
          map.off?.('idle', onIdle);
        };
        map.once?.('idle', onIdle);
      }

      // Apply data-driven color so points show actual feature color instead of single fallback
      if (Array.isArray(circleColor) && map.setPaintProperty) {
        try {
          map.setPaintProperty(pointLayerId, 'circle-color', circleColor as any);
        } catch (paintErr) {
          console.warn(
            `[gk-layer-styles] setPaintProperty circle-color failed for ${pointLayerId}:`,
            paintErr
          );
        }
      }
      // Apply custom point radius (data-driven or scaled) to override MapTiler helper's fixed radius
      if (pointRadius && map.setPaintProperty) {
        try {
          map.setPaintProperty(pointLayerId, 'circle-radius', pointRadius as any);
        } catch (radiusErr) {
          console.warn(
            `[gk-layer-styles] setPaintProperty circle-radius failed for ${pointLayerId}:`,
            radiusErr
          );
        }
      }
      // Apply base stroke width. Selection ring is handled by a dedicated layer (not the point stroke).
      if (map.setPaintProperty) {
        try {
          if (hoverPaint) {
            map.setPaintProperty(pointLayerId, 'circle-opacity', hoverPaint.pointOpacity as any);
          }
          const baseStrokeWidth = _circleStrokeWidth ?? 0;
          map.setPaintProperty(pointLayerId, 'circle-stroke-width', baseStrokeWidth as any);
          const strokeColorVal =
            _circleStrokeColor ??
            selectionRingColor ??
            resolveDefaultStrokeColor(document.documentElement);
          map.setPaintProperty(pointLayerId, 'circle-stroke-color', strokeColorVal as any);
        } catch (strokeErr) {
          console.warn(
            `[gk-layer-styles] setPaintProperty circle-stroke failed for ${pointLayerId}:`,
            strokeErr
          );
        }
      }
    } catch (error) {
      console.error(`[gk-layer-styles] MapTiler helpers.addPoint failed for ${pointLayerId}:`, error);
    }
  }

  // When helper was tried and failed, ensure source exists so the manual path can add layers.
  if (useHelper && !helperSucceeded && geojson && !map.getSource?.(sourceId)) {
    try {
      // tolerance: 0 prevents geojson-vt from dropping points at low zoom
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        tolerance: 0,
        ...(promoteId ? { promoteId } : {}),
      });
      debug.log('[layer-styles] source ADD (manual path)', { sourceId });
    } catch (sourceErr) {
      console.error(`[gk-layer-styles] Failed to add source ${sourceId}:`, sourceErr);
    }
  }

  if (helperSucceeded) {
    const helperCtx = { baseGlowRadius, resolvedGlowColor, hoverPaint };
    const finishHelperLayers = () => {
      finishSharedPointHelperLayerSet(config, helperCtx);
    };

    if (map.getLayer?.(pointLayerId)) {
      finishHelperLayers();
    } else {
      whenMapLayerExists(map, pointLayerId, finishHelperLayers);
    }
  }

  // Create glow layer (bottom) - serves as hit area and visual glow
  // Root cause: SDK coalesceChanges iterates over layout/paint; never pass null/undefined.
  if (!map.getLayer?.(glowLayerId)) {
    debug.log('[layer-styles] glow layer ADD (createSharedPointLayers)', {
      where: 'layer-styles.ts createSharedPointLayers',
      when: 'before addLayer',
      glowLayerId,
      sourceId,
      beforeLayerId: beforeLayerId ?? undefined,
    });
    addSharedPointGlowLayer({
      map,
      sourceId,
      glowLayerId,
      pointLayerId,
      baseGlowRadius,
      resolvedGlowColor,
      glowBlur,
      hoverPaint,
      glowOpacity,
      filter,
      beforeLayerId,
    });
  }

  // Point layer (top): zoom-based radius so points get larger as you zoom in; data-driven circle-color.
  // Selection stroke and ring both use feature-state 'selected' (requires promoteId on source).
  if (!map.getLayer?.(pointLayerId) && !helperSucceeded) {
    const circleColorVal = circleColor ?? resolveDefaultLayerColor();
    const radiusVal = pointRadius ?? getPointRadiusInterpolation();
    const pointPaint: Record<string, unknown> = {
      'circle-radius': radiusVal,
      'circle-color': circleColorVal,
      'circle-opacity':
        hoverPaint?.pointOpacity ?? (typeof _circleOpacity === 'number' ? _circleOpacity : 1),
      'circle-blur': 0,
    };
    pointPaint['circle-stroke-width'] = _circleStrokeWidth ?? 0;
    pointPaint['circle-stroke-color'] =
      _circleStrokeColor ??
      selectionRingColor ??
      resolveDefaultStrokeColor(document.documentElement);
    const pointLayerSpec: Record<string, unknown> = {
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      minzoom: 0, // Ensure visibility at all zoom levels
      layout: { visibility: 'visible' },
      paint: omitNil(pointPaint),
    };
    if (filter != null) pointLayerSpec.filter = filter;

    try {
      map.addLayer(pointLayerSpec as any);
    } catch (error) {
      console.error(`[gk-layer-styles] Failed to add point layer ${pointLayerId}:`, error, { sourceId });
      // Fallback: static white dots so points remain visible (data-driven color may have failed)
      try {
        const fallbackSpec = {
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
          minzoom: 0, // Ensure visibility at all zoom levels
          layout: { visibility: 'visible' as const },
          paint: {
            'circle-radius': 3,
            'circle-color': '#ffffff',
            'circle-opacity': 1,
            'circle-blur': 0,
          },
        } as Record<string, unknown>;
        if (filter != null) fallbackSpec.filter = filter;
        map.addLayer(fallbackSpec as any);
      } catch (fallbackError) {
        console.error(`[gk-layer-styles] Fallback point layer also failed ${pointLayerId}:`, fallbackError);
      }
    }

    // Selection ring: dedicated single-feature source so no data-driven expressions
    // are evaluated on all point features (avoids MapTiler per-tile rendering budget issues).
    setupSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      radiusVal,
      selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
    );
    if (selectionShadowColor) {
      setupSelectionShadowLayer(
        map,
        sourceId,
        pointLayerId,
        selectionShadowColor,
        radiusVal,
        selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
      );
    }
  }

  if (
    helperSucceeded &&
    map.getLayer?.(pointLayerId) &&
    map.getLayer?.(glowLayerId)
  ) {
    const effectivePointRadius = resolveEffectivePointRadius(pointRadius, true);
    setupSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      effectivePointRadius,
      selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
    );
    if (selectionShadowColor) {
      setupSelectionShadowLayer(
        map,
        sourceId,
        pointLayerId,
        selectionShadowColor,
        effectivePointRadius,
        selectionPointStrokeWidth || (_circleStrokeWidth ?? 0)
      );
    }
  }

  // Setup automatic hover layers using dedicated source (avoids feature-state issues)
  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
    glowRadius: baseGlowRadius,
    glowColor: resolvedGlowColor,
    glowBlur: glowBlur ?? resolveGlowBlur(),
    glowHoverOpacity,
    circleColor,
    pointRadius: pointRadius ?? getPointRadiusInterpolation(),
  });
}

// ============================================================================
// Hover Layer Setup (used by createSharedPointLayers)
// ============================================================================

export interface HoverLayerOptions {
  glowRadius: unknown[];
  glowColor: string | unknown[];
  glowBlur: number;
  glowHoverOpacity?: number | unknown[];
  circleColor: string | unknown[];
  pointRadius: unknown;
}

export const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** GeoJSON source with setData (MapLibre/MapTiler) */
export interface GeoJSONSourceWithSetData {
  setData?(data: GeoJSON.FeatureCollection | GeoJSON.Feature): void;
}

// ============================================================================
// Selection Ring (dedicated single-feature source)
// ============================================================================

/**
 * Create a dedicated source + layer for the selection ring.
 * Uses a single-feature source (0-1 features) so no data-driven expressions
 * are evaluated on all point features. Same pattern as hover layers.
 */

/** Shadow halo radius: slightly larger than the point for a raised look. */
export function getSelectionShadowRadiusFromPointRadius(
  pointRadius: unknown,
  pointStrokeWidth: unknown = 0
): unknown {
  const stroke = typeof pointStrokeWidth === 'number' ? pointStrokeWidth : 0;
  const shadowPad = 0.85;
  if (typeof pointRadius === 'number') return pointRadius + stroke + shadowPad;
  if (Array.isArray(pointRadius) && pointRadius[0] === 'interpolate') {
    return offsetRadiusInterpolation(pointRadius, stroke + shadowPad);
  }
  if (Array.isArray(pointRadius)) return ['+', pointRadius, stroke + shadowPad];
  return offsetRadiusInterpolation(getPointRadiusInterpolation(), stroke + shadowPad);
}

function setupSelectionShadowLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  selectionShadowColor: string,
  pointRadius?: unknown,
  pointStrokeWidth?: unknown
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const shadowLayerId = `${pointLayerId}-selection-shadow`;

  if (!map.getLayer?.(shadowLayerId)) {
    try {
      map.addLayer(
        {
          id: shadowLayerId,
          type: 'circle',
          source: selectionSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': getSelectionShadowRadiusFromPointRadius(
              pointRadius ?? getPointRadiusInterpolation(),
              pointStrokeWidth ?? 0
            ),
            'circle-color': selectionShadowColor,
            'circle-opacity': 0.42,
            'circle-blur': 0.7,
            'circle-stroke-width': 0,
          },
        } as any,
        pointLayerId
      );
      debug.log('[layer-styles] selection shadow layer ADD', { shadowLayerId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection shadow ${shadowLayerId}:`, err);
    }
  }
}

function setupSelectionRingLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  selectionRingColor: string,
  pointRadius?: unknown,
  pointStrokeWidth?: unknown
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const ringLayerId = `${pointLayerId}-selection-ring`;

  // Create dedicated selection source (empty initially)
  if (!map.getSource?.(selectionSourceId)) {
    try {
      map.addSource(selectionSourceId, {
        type: 'geojson',
        data: EMPTY_GEOJSON,
      });
      debug.log('[layer-styles] selection source ADD', { selectionSourceId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection source ${selectionSourceId}:`, err);
      return;
    }
  }

  // Create selection ring layer (pure zoom interpolation, no data-driven expressions)
  if (!map.getLayer?.(ringLayerId)) {
    try {
      map.addLayer({
        id: ringLayerId,
        type: 'circle',
        source: selectionSourceId,
        minzoom: 0,
        paint: {
          'circle-radius': getSelectionRingRadiusFromPointRadius(
            pointRadius ?? getPointRadiusInterpolation(),
            pointStrokeWidth ?? 0
          ),
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': SELECTION_RING_STROKE_WIDTH,
          'circle-stroke-color': selectionRingColor,
        },
      } as any);
      debug.log('[layer-styles] selection ring layer ADD', { ringLayerId });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection ring ${ringLayerId}:`, err);
    }
  }
}

export function ensureSelectionRingOnTop(map: MapInstance, pointLayerId: string): void {
  const ringLayerId = `${pointLayerId}-selection-ring`;
  if (!map.getLayer?.(ringLayerId) || !map.moveLayer) return;
  try {
    (map.moveLayer as (id: string) => void)(ringLayerId);
  } catch {
    /* layer order best-effort */
  }
}



export function ensureSharedPointSelectionRingLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  selectionRingColor: string,
  pointRadius?: unknown,
  pointStrokeWidth?: unknown
): void {
  setupSelectionRingLayer(
    map,
    sourceId,
    pointLayerId,
    selectionRingColor,
    pointRadius,
    pointStrokeWidth
  );

  const ringLayerId = `${pointLayerId}-selection-ring`;
  const ringRadius = getSelectionRingRadiusFromPointRadius(
    pointRadius ?? getPointRadiusInterpolation(),
    pointStrokeWidth ?? 0
  );
  if (map.getLayer?.(ringLayerId) && map.setPaintProperty) {
    map.setPaintProperty(ringLayerId, 'circle-radius', ringRadius as never);
    map.setPaintProperty(ringLayerId, 'circle-stroke-color', selectionRingColor);
    map.setPaintProperty(ringLayerId, 'circle-stroke-width', SELECTION_RING_STROKE_WIDTH);
  }

  ensureSelectionRingOnTop(map, pointLayerId);
}

/** Canonical point coordinates from the GeoJSON source (not click lngLat). */
export function lookupSharedPointCoords(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): { lng: number; lat: number } | null {
  const source = map.getSource?.(sourceId) as
    | {
        _data?: GeoJSON.FeatureCollection;
        _geojson?: GeoJSON.FeatureCollection;
        data?: GeoJSON.FeatureCollection;
      }
    | undefined;
  if (!source) return null;
  const data = source._data ?? source._geojson ?? source.data;
  if (!data?.features?.length) return null;

  const target = String(featureId);
  const feature = data.features.find((item) => {
    if (!item.properties) return false;
    return idProperties.some((prop) => String(item.properties?.[prop] ?? '') === target);
  });
  return feature ? extractPointLngLat(feature.geometry) : null;
}

export function resolveSharedPointSelectionLngLat(
  map: MapInstance,
  sourceId: string,
  featureId: string | null,
  eventGeometry: unknown,
  clickLngLat?: { lng: number; lat: number } | null,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): { lng: number; lat: number } | null {
  if (featureId) {
    const fromSource = lookupSharedPointCoords(map, sourceId, String(featureId), idProperties);
    if (fromSource) return fromSource;
  }
  return extractPointLngLat(eventGeometry) ?? clickLngLat ?? null;
}

/**
 * Update the selection ring for shared point layers.
 * Sets the dedicated selection source to a single Point feature at the given
 * coordinates, or clears it when coordinates is null.
 *
 * @param map - Map instance
 * @param sourceId - The base source ID used when creating the shared point layers
 * @param coordinates - Selected point coordinates, or null to clear
 */
export function updateSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  selection: { lngLat: { lng: number; lat: number }; properties?: Record<string, unknown> } | null
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const source = map?.getSource?.(selectionSourceId) as GeoJSONSourceWithSetData | undefined;
  if (!source?.setData) return;

  try {
    if (selection?.lngLat) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [selection.lngLat.lng, selection.lngLat.lat],
            },
            properties: { ...(selection.properties ?? {}) },
          },
        ],
      });
    } else {
      source.setData(EMPTY_GEOJSON);
    }
  } catch {
    // Ignore - source may have been removed
  }
}

/** Property order for resolving feature ids on shared point layers. */
export const DEFAULT_SHARED_POINT_ID_PROPERTIES = ['slug', 'id', 'point-id', 'id:google-maps'];

export interface SharedPointSelectionState {
  featureId: string | null;
  lngLat: { lng: number; lat: number } | null;
}

export interface SetSharedPointSelectionOptions {
  idProperties?: string[];
  /** Point layer id — used to keep the ring above the dot. */
  pointLayerId?: string;
  /** Ring stroke color when the selection layer must be mounted lazily. */
  selectionRingColor?: string;
  /** Point outline width (px) for ring radius math when mounting lazily. */
  selectionPointStrokeWidth?: number;
  /** When set with dispatchEvent, fires gk-shared-point-selected on this element. */
  mapElement?: HTMLElement | null;
  dispatchEvent?: boolean;
}

function readPointRadiusFromLayer(map: MapInstance, pointLayerId: string): unknown {
  if (!map.getLayer?.(pointLayerId)) {
    return getPointRadiusInterpolation();
  }
  try {
    const getPaint = (map as { getPaintProperty?: (id: string, prop: string) => unknown })
      .getPaintProperty;
    const live = getPaint?.(pointLayerId, 'circle-radius');
    return Array.isArray(live) ? live : getPointRadiusInterpolation();
  } catch {
    return getPointRadiusInterpolation();
  }
}

/** Mount selection source + ring when MapTiler helper skipped them during layer create. */
function ensureSelectionRingReady(
  map: MapInstance,
  sourceId: string,
  options?: SetSharedPointSelectionOptions
): void {
  const pointLayerId =
    options?.pointLayerId ?? resolveSharedPointLayerIdForSource(map, sourceId);
  if (!pointLayerId || !map.getLayer?.(pointLayerId)) return;

  const selectionRingColor =
    options?.selectionRingColor ??
    (typeof document !== 'undefined'
      ? resolveDefaultStrokeColor(document.documentElement)
      : '#ffffff');
  try {
    ensureSharedPointSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      readPointRadiusFromLayer(map, pointLayerId),
      options?.selectionPointStrokeWidth ?? 0
    );
  } catch {
    // Style may not be loaded yet (e.g. visibility restore) — ring data still updates below.
  }
}

const sharedPointSelectionByMap = new WeakMap<
  MapInstance,
  Map<string, SharedPointSelectionState>
>();

function getSharedPointSelectionMap(map: MapInstance): Map<string, SharedPointSelectionState> {
  let registry = sharedPointSelectionByMap.get(map);
  if (!registry) {
    registry = new Map();
    sharedPointSelectionByMap.set(map, registry);
  }
  return registry;
}

export function getSharedPointSelection(
  map: MapInstance,
  sourceId: string
): SharedPointSelectionState | null {
  return getSharedPointSelectionMap(map).get(sourceId) ?? null;
}

export function clearSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  options?: SetSharedPointSelectionOptions
): void {
  setSharedPointSelection(map, sourceId, { featureId: null, lngLat: null }, options);
}

/**
 * Move the shared-point selection ring and track the selected feature id.
 * Prefer gk-map.setSelectedPoint() from app code; this is used internally on click.
 */
export function setSharedPointSelection(
  map: MapInstance,
  sourceId: string,
  selection: {
    featureId: string | null;
    lngLat?: { lng: number; lat: number } | null;
    properties?: Record<string, unknown> | null;
  },
  options?: SetSharedPointSelectionOptions
): void {
  const previous = getSharedPointSelection(map, sourceId);
  const previousFeatureId = previous?.featureId ?? null;
  const featureId = selection.featureId;
  const lngLat = selection.lngLat ?? null;
  const properties = selection.properties ?? null;
  const idProperties = options?.idProperties ?? DEFAULT_SHARED_POINT_ID_PROPERTIES;

  if (!featureId || !lngLat) {
    getSharedPointSelectionMap(map).set(sourceId, { featureId: null, lngLat: null });
    updateSharedPointSelection(map, sourceId, null);
  } else {
    const resolvedLngLat =
      lookupSharedPointCoords(map, sourceId, String(featureId), idProperties) ?? lngLat;
    getSharedPointSelectionMap(map).set(sourceId, { featureId, lngLat: resolvedLngLat });
    ensureSelectionRingReady(map, sourceId, options);
    updateSharedPointSelection(map, sourceId, {
      lngLat: resolvedLngLat,
      ...(properties ? { properties } : {}),
    });
    clearSharedPointHoverOverlay(map, sourceId);
    const pointLayerId =
      options?.pointLayerId ?? resolveSharedPointLayerIdForSource(map, sourceId);
    if (pointLayerId) {
      ensureSelectionRingOnTop(map, pointLayerId);
    }
  }

  const changed = featureId !== previousFeatureId;
  if (options?.dispatchEvent && options.mapElement && changed) {
    options.mapElement.dispatchEvent(
      new CustomEvent('gk-shared-point-selected', {
        detail: {
          sourceId,
          featureId,
          previousFeatureId,
          lngLat,
          map,
          element: options.mapElement,
        },
        bubbles: true,
      })
    );
  }
}

function clearSharedPointHoverOverlay(map: MapInstance, sourceId: string): void {
  const hoverSourceId = `${sourceId}-hover`;
  const source = map.getSource?.(hoverSourceId) as GeoJSONSourceWithSetData | undefined;
  if (!source?.setData) return;
  try {
    source.setData(EMPTY_GEOJSON);
  } catch {
    // Source may have been removed during style swap
  }
}

export function extractPointLngLat(geometry: unknown): { lng: number; lat: number } | null {
  if (
    geometry &&
    typeof geometry === 'object' &&
    'type' in geometry &&
    (geometry as { type?: string }).type === 'Point' &&
    'coordinates' in geometry
  ) {
    const coords = (geometry as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        return { lng, lat };
      }
    }
  }
  return null;
}

// ============================================================================
// Hover Layer Setup (used by createSharedPointLayers)
// ============================================================================

/**
 * Setup hover handlers for shared point layers.
 * Hover highlight uses feature-state on the main glow layer (same source/geometry as the dot).
 */
function setupHoverLayers(
  map: MapInstance,
  sourceId: string,
  glowLayerId: string,
  pointLayerId: string,
  _options: HoverLayerOptions
): void {
  // Hit-test glow + point so clicks register on the painted dot and its halo.
  const hitLayerIds = [glowLayerId, pointLayerId].filter(
    (id, index, arr) => !!id && !!map.getLayer?.(id) && arr.indexOf(id) === index
  );
  const leaveLayerId = map.getLayer?.(glowLayerId) ? glowLayerId : pointLayerId;
  debug.log('[layer-styles] setupHoverLayers', { hitLayerIds, leaveLayerId, sourceId });
  if (!hitLayerIds.length) {
    debug.log('[layer-styles] setupHoverLayers: no hit layers, skipping');
    return;
  }

  let lastHoveredFeatureId: string | number | null = null;
  /** Coordinates of the last dispatched gk-point-hover (dedup glow+point layer hits). */
  let lastDispatchedKey: string | null = null;

  /** Find the parent gk-map element from the map instance (for event dispatch). */
  function findMapElement(): HTMLElement | null {
    const container = (map as any).getContainer?.();
    if (!container) return null;
    let el: HTMLElement | null = container as HTMLElement;
    while (el) {
      if (el.tagName?.toLowerCase() === 'gk-map') return el;
      el = el.parentElement;
    }
    return null;
  }

  function clearHoverFeatureState(): void {
    if (lastHoveredFeatureId == null) return;
    if (map.removeFeatureState && map.getSource?.(sourceId)) {
      try {
        map.removeFeatureState({ source: sourceId, id: lastHoveredFeatureId });
      } catch {
        // Source may have been removed during style swap
      }
    }
    lastHoveredFeatureId = null;
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

  /** Dispatch gk-point-hover-end from the gk-map element and clear tracking state. */
  function dispatchHoverEnd(): void {
    if (lastDispatchedKey !== null) {
      lastDispatchedKey = null;
      const mapEl = findMapElement();
      if (mapEl) {
        mapEl.dispatchEvent(
          new CustomEvent('gk-point-hover-end', {
            detail: { sourceId, map, element: mapEl },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }
  }

  function endHover(): void {
    clearHoverFeatureState();
    setCursor('');
    dispatchHoverEnd();
  }

  /** Coordinate key of the feature currently under the cursor (mousemove dedup). */
  let currentHoverKey: string | null = null;

  function onMouseMove(e: {
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
  }): void {
    const features = e?.features;
    if (!features?.length) {
      if (currentHoverKey !== null) {
        currentHoverKey = null;
        endHover();
      }
      return;
    }

    setCursor('pointer');
    const f = features[0];
    const geometry = f?.geometry;
    if (!geometry) {
      if (currentHoverKey !== null) {
        currentHoverKey = null;
        endHover();
      }
      return;
    }

    const lngLat = extractPointLngLat(geometry);
    const key = lngLat ? `${lngLat.lng},${lngLat.lat}` : null;
    if (key === currentHoverKey) return;

    currentHoverKey = key;

    const featureForId = {
      type: 'Feature',
      properties: f?.properties ?? {},
      geometry,
    } as Feature;
    const featureId = getFeatureId(featureForId, DEFAULT_SHARED_POINT_ID_PROPERTIES);

    if (featureId != null && featureId !== lastHoveredFeatureId) {
      clearHoverFeatureState();
      if (map.setFeatureState && map.getSource?.(sourceId)) {
        try {
          map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
          lastHoveredFeatureId = featureId;
        } catch {
          // promoteId missing on source
        }
      }
    }

    if (key && key !== lastDispatchedKey) {
      lastDispatchedKey = key;
      const mapEl = findMapElement();
      if (mapEl) {
        mapEl.dispatchEvent(
          new CustomEvent('gk-point-hover', {
            detail: {
              lngLat: lngLat ?? undefined,
              features: [...features],
              sourceId,
              map,
              element: mapEl,
            },
            bubbles: true,
            cancelable: true,
          })
        );
      }
    }
  }

  function onMouseLeave(): void {
    currentHoverKey = null;
    endHover();
  }

  // Click handler: move selection ring, then dispatch gk-point-click from the gk-map element.
  // Single hit layer means no glow+point double-fire, but keep cooldown for safety.
  let lastClickTime = 0;
  function onClick(e: {
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
    lngLat?: { lng: number; lat: number };
    originalEvent?: Event;
  }): void {
    const now = Date.now();
    if (now - lastClickTime < 50) return; // dedup glow+point double-fire
    lastClickTime = now;
    endHover();

    const features = e?.features;
    if (!features?.length) return;

    const f = features[0];
    const geometry = f?.geometry;

    const mapEl = findMapElement();
    const featureForId = {
      type: 'Feature',
      properties: f?.properties ?? {},
      geometry: geometry ?? { type: 'Point', coordinates: [0, 0] },
    } as Feature;
    const featureId = getFeatureId(featureForId, DEFAULT_SHARED_POINT_ID_PROPERTIES);
    const lngLat = resolveSharedPointSelectionLngLat(
      map,
      sourceId,
      featureId != null ? String(featureId) : null,
      geometry,
      e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null
    );

    if (lngLat) {
      setSharedPointSelection(
        map,
        sourceId,
        { featureId, lngLat, properties: f?.properties ?? {} },
        { mapElement: mapEl, dispatchEvent: true, pointLayerId }
      );
    }

    if (mapEl) {
      mapEl.dispatchEvent(
        new CustomEvent('gk-point-click', {
          detail: {
            lngLat: lngLat ?? undefined,
            features: [...features],
            sourceId,
            featureId,
            map,
            element: mapEl,
            originalEvent: e.originalEvent,
          },
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }

  // Glow + point layers: click/move on both; mouseleave on wider glow only.
  try {
    for (const layerId of hitLayerIds) {
      map.on('mousemove', layerId, onMouseMove as any);
      map.on('click', layerId, onClick as any);
    }
    if (leaveLayerId) {
      map.on('mouseleave', leaveLayerId, onMouseLeave as any);
    }
    debug.log('[layer-styles] attached mousemove+click handlers', hitLayerIds);
  } catch (err) {
    debug.log('[layer-styles] FAILED to attach handlers', hitLayerIds, err);
  }
}

/**
 * Create GK point shared layers and return hover handlers that use a dedicated hover source+layer
 * (setData) instead of feature-state, avoiding MapTiler SDK "unknown feature value" errors on
 * vector tile sources. Attach the returned onMouseEnter/onMouseLeave to your glow and point
 * layer IDs (e.g. map.on('mouseenter', layerId, hover.onMouseEnter)).
 *
 * @param config - Same as SharedPointLayersConfig; promoteId is used to identify the hovered feature.
 * @returns Hover handlers to attach to the shared point layers (glowLayerId, pointLayerId).
 */
