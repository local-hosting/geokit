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
  literalNumberFromPaintExpression,
  resolveSharedPointFloatingBadgeTokens,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
  lightenHexTowardWhite,
  sharedPointFloatingBadgeGlassRadiusExpression,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeSelectionTranslateAt,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeTranslateAtZoom,
  sharedPointGlassLayerId,
  sharedPointHitLayerIds,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
  sharedPointOuterStrokeLayerId,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
  syncSharedPointSelectedLayerFilter,
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
  resolveMapTilerHelperPointColor,
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
const DEFAULT_SELECTION_SHADOW_TRANSLATE: [number, number] = [2, 2];

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
  glowTranslate?: [number, number];
  glowPitchAlignment?: 'map' | 'viewport';
  glowPitchScale?: 'map' | 'viewport';
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
    glowTranslate,
    glowPitchAlignment,
    glowPitchScale,
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
  if (glowTranslate != null) {
    glowPaint['circle-translate'] = glowTranslate;
  }
  if (glowPitchAlignment != null) {
    glowPaint['circle-pitch-alignment'] = glowPitchAlignment;
  }
  if (glowPitchScale != null) {
    glowPaint['circle-pitch-scale'] = glowPitchScale;
  }
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
    outerStrokeColor,
    outerStrokeWidth,
    glowTranslate,
    glowPitchAlignment,
    glowPitchScale,
    pointTranslate,
    hoverTranslate,
    selectedTranslate,
    selectionShadowTranslate = DEFAULT_SELECTION_SHADOW_TRANSLATE,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
    promoteId,
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
    glowTranslate,
    glowPitchAlignment,
    glowPitchScale,
  });
  if (!glowAdded) return false;

  const effectivePointRadius = resolveEffectivePointRadius(pointRadius, true);
  if (map.setPaintProperty) {
    if (pointRadius === undefined) {
      try {
        map.setPaintProperty(pointLayerId, 'circle-radius', effectivePointRadius as any);
      } catch (radiusErr) {
        console.warn(
          `[gk-layer-styles] setPaintProperty circle-radius failed for ${pointLayerId}:`,
          radiusErr
        );
      }
    }
    if (pointTranslate != null) {
      try {
        map.setPaintProperty(pointLayerId, 'circle-translate', pointTranslate);
      } catch (translateErr) {
        console.warn(
          `[gk-layer-styles] setPaintProperty circle-translate failed for ${pointLayerId}:`,
          translateErr
        );
      }
    }
  }

  if (outerStrokeWidth != null && outerStrokeColor != null) {
    setupSharedPointOuterStrokeLayer(map, sourceId, pointLayerId, {
      pointRadius: effectivePointRadius,
      coloredStrokeWidth: _circleStrokeWidth ?? 0,
      outerStrokeWidth,
      outerStrokeColor,
      filter,
      pointTranslate,
    });
  }

  setupSharedPointSelectionChrome(map, sourceId, pointLayerId, {
    selectionRingColor,
    selectionShadowColor,
    pointRadius: effectivePointRadius,
    pointStrokeWidth: selectionPointStrokeWidth || (_circleStrokeWidth ?? 0),
    pointTranslate,
    selectionShadowTranslate,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
  });

  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
    glowRadius: baseGlowRadius as unknown[],
    glowColor: resolvedGlowColor,
    glowBlur: glowBlur ?? resolveGlowBlur(),
    glowHoverOpacity,
    circleColor,
    pointRadius: effectivePointRadius,
    promoteId,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
    selectionPointStrokeWidth: selectionPointStrokeWidth || (_circleStrokeWidth ?? 0),
    selectionRingColor,
    floatTranslate: pointTranslate,
    hoverTranslate,
    selectedTranslate,
  });
  return true;
}

function setupSharedPointSelectionChrome(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  options: {
    selectionRingColor: string;
    selectionShadowColor?: string;
    pointRadius: unknown;
    pointStrokeWidth: unknown;
    pointTranslate?: [number, number];
    selectionShadowTranslate: [number, number];
    selectionGroundBadge?: boolean;
    selectionGroundBadgeFallbackColor?: string;
  }
): void {
  const {
    selectionRingColor,
    selectionShadowColor,
    pointStrokeWidth,
    pointTranslate,
    selectionShadowTranslate,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
  } = options;
  const pointRadius = selectionGroundBadge
    ? sharedPointFloatingBadgeSelectedRadiusExpression()
    : options.pointRadius;
  const ringTranslate = selectionGroundBadge ? undefined : pointTranslate;

  // Floating-badge active state = lowered badge + stronger grounded shadow (no halo ring).
  if (!selectionGroundBadge) {
    setupSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      pointRadius,
      pointStrokeWidth,
      ringTranslate
    );
    if (selectionShadowColor) {
      setupSelectionShadowLayer(
        map,
        sourceId,
        pointLayerId,
        selectionShadowColor,
        pointRadius,
        pointStrokeWidth,
        selectionShadowTranslate
      );
    }
  }
  if (selectionGroundBadge) {
    // Still need the empty selection source for the lowered badge feature.
    setupSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      pointRadius,
      pointStrokeWidth,
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE
    );
    const ringLayerId = `${pointLayerId}-selection-ring`;
    if (map.getLayer?.(ringLayerId) && map.setPaintProperty) {
      try {
        map.setPaintProperty(ringLayerId, 'circle-opacity', 0);
        map.setPaintProperty(ringLayerId, 'circle-stroke-opacity', 0);
        map.setPaintProperty(ringLayerId, 'circle-stroke-width', 0);
      } catch {
        /* ignore */
      }
    }
    const tokens = resolveSharedPointFloatingBadgeTokens();
    const selectedShadowRadius = scaleInterpolateRadiusStops(
      sharedPointFloatingBadgeShadowRadiusExpression(
        undefined,
        tokens.shadowRadiusPad
      ) as unknown[],
      tokens.selectedShadowScale
    );
    setupSelectionShadowLayer(
      map,
      sourceId,
      pointLayerId,
      selectionShadowColor ?? tokens.shadowColor,
      pointRadius,
      pointStrokeWidth,
      SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE
    );
    const shadowLayerId = `${pointLayerId}-selection-shadow`;
    if (map.getLayer?.(shadowLayerId) && map.setPaintProperty) {
      try {
        map.setPaintProperty(shadowLayerId, 'circle-radius', selectedShadowRadius);
        map.setPaintProperty(shadowLayerId, 'circle-opacity', tokens.selectedShadowOpacity);
        map.setPaintProperty(shadowLayerId, 'circle-blur', tokens.shadowBlur);
        map.setPaintProperty(shadowLayerId, 'circle-color', tokens.shadowColor);
        map.setPaintProperty(shadowLayerId, 'circle-translate', SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE);
        map.setPaintProperty(shadowLayerId, 'circle-pitch-alignment', 'map');
        map.setPaintProperty(shadowLayerId, 'circle-pitch-scale', 'map');
      } catch {
        /* ignore */
      }
    }
    setupSelectionGroundBadgeLayers(map, sourceId, pointLayerId, {
      fallbackColor: selectionGroundBadgeFallbackColor,
    });
  }
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
    outerStrokeColor,
    outerStrokeWidth,
    glowTranslate,
    glowPitchAlignment,
    glowPitchScale,
    pointTranslate,
    pointTranslateAnchor,
    hoverTranslate,
    selectedTranslate,
    selectionShadowTranslate = DEFAULT_SELECTION_SHADOW_TRANSLATE,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
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

      // Helper only accepts a single color; unwrap ['literal', hex] so we don't flash --gk-point-color blue
      const singleColor = resolveMapTilerHelperPointColor(circleColor, themeElement);
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
      glowTranslate,
      glowPitchAlignment,
      glowPitchScale,
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
    if (pointTranslate != null) {
      pointPaint['circle-translate'] = pointTranslate;
      pointPaint['circle-translate-anchor'] = pointTranslateAnchor ?? 'viewport';
    }
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

    if (outerStrokeWidth != null && outerStrokeColor != null) {
      setupSharedPointOuterStrokeLayer(map, sourceId, pointLayerId, {
        pointRadius: radiusVal,
        coloredStrokeWidth: _circleStrokeWidth ?? 0,
        outerStrokeWidth,
        outerStrokeColor,
        filter,
        pointTranslate,
      });
    }

    // Selection ring: dedicated single-feature source so no data-driven expressions
    // are evaluated on all point features (avoids MapTiler per-tile rendering budget issues).
    setupSharedPointSelectionChrome(map, sourceId, pointLayerId, {
      selectionRingColor,
      selectionShadowColor,
      pointRadius: radiusVal,
      pointStrokeWidth: selectionPointStrokeWidth || (_circleStrokeWidth ?? 0),
      pointTranslate,
      selectionShadowTranslate,
      selectionGroundBadge,
      selectionGroundBadgeFallbackColor,
    });
  }

  if (
    helperSucceeded &&
    map.getLayer?.(pointLayerId) &&
    map.getLayer?.(glowLayerId)
  ) {
    const effectivePointRadius = resolveEffectivePointRadius(pointRadius, true);
    if (pointTranslate != null && map.setPaintProperty) {
      try {
        map.setPaintProperty(pointLayerId, 'circle-translate', pointTranslate);
      } catch {
        /* helper layers may reject translate briefly */
      }
    }
    setupSharedPointSelectionChrome(map, sourceId, pointLayerId, {
      selectionRingColor,
      selectionShadowColor,
      pointRadius: effectivePointRadius,
      pointStrokeWidth: selectionPointStrokeWidth || (_circleStrokeWidth ?? 0),
      pointTranslate,
      selectionShadowTranslate,
      selectionGroundBadge,
      selectionGroundBadgeFallbackColor,
    });
  }

  // Setup automatic hover layers using dedicated source (avoids feature-state issues)
  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
    glowRadius: baseGlowRadius,
    glowColor: resolvedGlowColor,
    glowBlur: glowBlur ?? resolveGlowBlur(),
    glowHoverOpacity,
    circleColor,
    pointRadius: pointRadius ?? getPointRadiusInterpolation(),
    promoteId,
    selectionGroundBadge,
    selectionGroundBadgeFallbackColor,
    selectionPointStrokeWidth: selectionPointStrokeWidth || (_circleStrokeWidth ?? 0),
    selectionRingColor,
    floatTranslate: pointTranslate,
    hoverTranslate,
    selectedTranslate,
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
  /** promoteId / primary feature id property (e.g. `venueId`). */
  promoteId?: string;
  /** Keep selection halo off when grounded floating-badge is active. */
  selectionGroundBadge?: boolean;
  selectionGroundBadgeFallbackColor?: string;
  selectionPointStrokeWidth?: number;
  selectionRingColor?: string;
  /** Resting badge translate (floating-badge). Zoom expression or `[x, y]`. */
  floatTranslate?: [number, number] | unknown[];
  /** Hover badge translate — slightly higher so the ground shadow reads smaller. */
  hoverTranslate?: [number, number] | unknown[];
  /** Selected badge translate — restore target when leaving hover on a selected point. */
  selectedTranslate?: [number, number] | unknown[];
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

/**
 * Soft frosted disc behind unselected floating badges (MapLibre blur ≈ glass).
 * Drawn under outer-stroke / point; hidden with the resting stack when selected.
 */
export function setupSharedPointGlassLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  options: {
    glassRadius: unknown;
    glassColor: string | unknown[];
    glassOpacity?: number;
    glassBlur?: number;
    filter?: unknown[];
    pointTranslate?: [number, number];
  }
): void {
  const glassLayerId = sharedPointGlassLayerId(pointLayerId);
  if (map.getLayer?.(glassLayerId)) return;

  const paint: Record<string, unknown> = {
    'circle-radius': options.glassRadius,
    'circle-color': options.glassColor,
    'circle-opacity': options.glassOpacity ?? SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
    'circle-blur': options.glassBlur ?? SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
    'circle-stroke-width': 0,
  };
  if (options.pointTranslate != null) {
    paint['circle-translate'] = options.pointTranslate;
    paint['circle-translate-anchor'] = 'viewport';
  }
  const layerSpec: Record<string, unknown> = {
    id: glassLayerId,
    type: 'circle',
    source: sourceId,
    minzoom: 0,
    layout: { visibility: 'visible' },
    paint: omitNil(paint),
  };
  if (options.filter != null) layerSpec.filter = options.filter;

  const beforeId = map.getLayer?.(sharedPointOuterStrokeLayerId(pointLayerId))
    ? sharedPointOuterStrokeLayerId(pointLayerId)
    : map.getLayer?.(pointLayerId)
      ? pointLayerId
      : undefined;

  try {
    if (beforeId) {
      map.addLayer(layerSpec as any, beforeId);
    } else {
      map.addLayer(layerSpec as any);
    }
    debug.log('[layer-styles] glass layer ADD', { glassLayerId });
  } catch (err) {
    console.error(`[gk-layer-styles] Failed to add glass ${glassLayerId}:`, err);
  }
}

/**
 * Outer stroke around the colored ring (transparent fill + stroke outside fill+ring).
 * Drawn below the point layer so the colored ring sits on top of the white halo start.
 */
export function setupSharedPointOuterStrokeLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  options: {
    pointRadius: unknown;
    coloredStrokeWidth: number | unknown[];
    outerStrokeWidth: number | unknown[];
    outerStrokeColor: string | unknown[];
    outerStrokeOpacity?: number;
    filter?: unknown[];
    pointTranslate?: [number, number] | unknown[];
  }
): void {
  const coloredWidth = literalNumberFromPaintExpression(options.coloredStrokeWidth);
  const outerWidth = literalNumberFromPaintExpression(options.outerStrokeWidth);
  // Zoom-interpolate widths are arrays — literalNumber falls back to 0; still create the layer.
  const hasOuterWidth =
    (typeof options.outerStrokeWidth === 'number' && options.outerStrokeWidth > 0) ||
    (Array.isArray(options.outerStrokeWidth) && options.outerStrokeWidth.length > 0) ||
    outerWidth > 0;
  if (!hasOuterWidth) return;

  const outerStrokeLayerId = sharedPointOuterStrokeLayerId(pointLayerId);
  const ringForRadius = Array.isArray(options.coloredStrokeWidth)
    ? options.coloredStrokeWidth
    : coloredWidth;
  const radius = sharedPointRadiusPlusStrokeWidth(options.pointRadius, ringForRadius);
  const paint: Record<string, unknown> = {
    'circle-radius': radius,
    'circle-color': 'rgba(0,0,0,0)',
    'circle-opacity': 1,
    'circle-blur': 0,
    'circle-stroke-width': options.outerStrokeWidth,
    'circle-stroke-color': options.outerStrokeColor,
    'circle-stroke-opacity': options.outerStrokeOpacity ?? 1,
  };
  if (options.pointTranslate != null) {
    paint['circle-translate'] = options.pointTranslate;
    paint['circle-translate-anchor'] = 'viewport';
  }

  if (map.getLayer?.(outerStrokeLayerId)) {
    // Layer may exist from an older failed paint — force white edge + safe radius.
    if (map.setPaintProperty) {
      try {
        for (const [key, value] of Object.entries(paint)) {
          map.setPaintProperty(outerStrokeLayerId, key, value);
        }
      } catch {
        /* style swap */
      }
    }
    return;
  }

  const layerSpec: Record<string, unknown> = {
    id: outerStrokeLayerId,
    type: 'circle',
    source: sourceId,
    minzoom: 0,
    layout: { visibility: 'visible' },
    paint: omitNil(paint),
  };
  if (options.filter != null) layerSpec.filter = options.filter;

  try {
    // Insert under the point layer when it already exists.
    if (map.getLayer?.(pointLayerId)) {
      map.addLayer(layerSpec as any, pointLayerId);
    } else {
      map.addLayer(layerSpec as any);
    }
    debug.log('[layer-styles] outer stroke layer ADD', { outerStrokeLayerId });
  } catch (err) {
    console.error(`[gk-layer-styles] Failed to add outer stroke ${outerStrokeLayerId}:`, err);
  }
}

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

/**
 * Single-feature hover badge on `${sourceId}-hover` — circle-translate is layer-wide,
 * so only the hovered feature is copied here and lifted.
 */
export function setupFloatingBadgeHoverBadgeLayers(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  options?: {
    fallbackColor?: string;
    colorProperty?: string;
    glowLayerId?: string;
  }
): void {
  const hoverSourceId = `${sourceId}-hover`;
  const badgeLayerId = sharedPointHoverBadgeLayerId(pointLayerId);
  const badgeOuterLayerId = sharedPointHoverBadgeOuterLayerId(pointLayerId);
  const colorProperty = options?.colorProperty ?? '_color';
  const fallbackColor = options?.fallbackColor?.trim() || '#888888';
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const ringColor = [
    'coalesce',
    ['get', colorProperty],
    ['get', 'color'],
    ['get', 'marker-color'],
    fallbackColor,
  ];
  const softFill = [
    'coalesce',
    ['get', SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY],
    sharedPointFloatingBadgeSoftColor(fallbackColor),
  ];
  const badgeRadius = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth);
  const outerWidth = sharedPointFloatingBadgeOuterStrokeWidthExpression(
    tokens.outerStrokeWidth
  );

  if (!map.getSource?.(hoverSourceId)) {
    try {
      map.addSource?.(hoverSourceId, {
        type: 'geojson',
        data: EMPTY_GEOJSON,
      });
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover source ${hoverSourceId}:`, err);
      return;
    }
  }

  // Legacy hover glow/point layers share this source — hide so setData cannot paint a black aura.
  const glowLayerId =
    options?.glowLayerId ??
    (pointLayerId.endsWith('-point')
      ? `${pointLayerId.slice(0, -'-point'.length)}-glow`
      : undefined);
  for (const legacyId of [
    `${pointLayerId}-hover`,
    glowLayerId ? `${glowLayerId}-hover` : null,
  ]) {
    if (!legacyId || !map.getLayer?.(legacyId) || !map.setLayoutProperty) continue;
    try {
      map.setLayoutProperty(legacyId, 'visibility', 'none');
    } catch {
      /* style swap */
    }
  }

  if (!map.getLayer?.(badgeOuterLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeOuterLayerId,
          type: 'circle',
          source: hoverSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': sharedPointRadiusPlusStrokeWidth(badgeRadius, ringWidth),
            'circle-color': 'rgba(0,0,0,0)',
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': outerWidth,
            'circle-stroke-color': tokens.outerStrokeColor,
            'circle-stroke-opacity': tokens.outerStrokeOpacity,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        pointLayerId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover badge outer ${badgeOuterLayerId}:`, err);
    }
  }

  if (!map.getLayer?.(badgeLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeLayerId,
          type: 'circle',
          source: hoverSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': badgeRadius,
            'circle-color': softFill,
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': ringWidth,
            'circle-stroke-color': ringColor,
            'circle-stroke-opacity': tokens.strokeOpacity,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        map.getLayer?.(badgeOuterLayerId) ? badgeOuterLayerId : pointLayerId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover badge ${badgeLayerId}:`, err);
    }
  } else if (map.setPaintProperty) {
    try {
      map.setPaintProperty(badgeLayerId, 'circle-translate', tokens.floatTranslate);
      map.setPaintProperty(badgeLayerId, 'circle-translate-anchor', 'viewport');
      if (map.getLayer?.(badgeOuterLayerId)) {
        map.setPaintProperty(badgeOuterLayerId, 'circle-translate', tokens.floatTranslate);
        map.setPaintProperty(badgeOuterLayerId, 'circle-translate-anchor', 'viewport');
      }
    } catch {
      /* style swap */
    }
  }
}

/**
 * Enlarged grounded badge on the selection source (lands on the map when selected).
 * Drawn above the selection shadow and below the selection ring.
 */
export function setupSelectionGroundBadgeLayers(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  options?: {
    fallbackColor?: string;
    colorProperty?: string;
  }
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const badgeLayerId = `${pointLayerId}-selection-badge`;
  const badgeOuterLayerId = `${pointLayerId}-selection-badge-outer`;
  const colorProperty = options?.colorProperty ?? '_color';
  const fallbackColor = options?.fallbackColor?.trim() || '#888888';
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
  const tokens = resolveSharedPointFloatingBadgeTokens();
  // Selected: white core + key ring + white outer (same chrome as resting).
  const fillColor = tokens.fill;
  const ringColor = [
    'coalesce',
    ['get', colorProperty],
    ['get', 'color'],
    ['get', 'marker-color'],
    fallbackColor,
  ];

  if (!map.getSource?.(selectionSourceId)) return;

  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth);
  const outerWidth = sharedPointFloatingBadgeOuterStrokeWidthExpression(
    tokens.outerStrokeWidth
  );

  // Stronger grounded shadow under the selected badge (main glow is filtered away).
  const selectedShadowRadius = scaleInterpolateRadiusStops(
    sharedPointFloatingBadgeShadowRadiusExpression(
      undefined,
      tokens.shadowRadiusPad
    ) as unknown[],
    tokens.selectedShadowScale
  );
  setupSelectionShadowLayer(
    map,
    sourceId,
    pointLayerId,
    tokens.shadowColor,
    selectedRadius,
    tokens.coloredRingWidth,
    SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE
  );
  const shadowLayerId = `${pointLayerId}-selection-shadow`;
  if (map.getLayer?.(shadowLayerId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(shadowLayerId, 'circle-radius', selectedShadowRadius);
      map.setPaintProperty(shadowLayerId, 'circle-opacity', tokens.selectedShadowOpacity);
      map.setPaintProperty(shadowLayerId, 'circle-blur', tokens.shadowBlur);
      map.setPaintProperty(shadowLayerId, 'circle-color', tokens.shadowColor);
      map.setPaintProperty(
        shadowLayerId,
        'circle-translate',
        SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE
      );
      map.setPaintProperty(shadowLayerId, 'circle-pitch-alignment', 'map');
      map.setPaintProperty(shadowLayerId, 'circle-pitch-scale', 'map');
    } catch {
      /* ignore */
    }
  }

  if (!map.getLayer?.(badgeOuterLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeOuterLayerId,
          type: 'circle',
          source: selectionSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': sharedPointRadiusPlusStrokeWidth(selectedRadius, ringWidth),
            'circle-color': 'rgba(0,0,0,0)',
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': outerWidth,
            'circle-stroke-color': tokens.outerStrokeColor,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        map.getLayer?.(`${pointLayerId}-selection-ring`)
          ? `${pointLayerId}-selection-ring`
          : pointLayerId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection badge outer ${badgeOuterLayerId}:`, err);
    }
  }

  if (!map.getLayer?.(badgeLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeLayerId,
          type: 'circle',
          source: selectionSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': selectedRadius,
            'circle-color': fillColor,
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': ringWidth,
            'circle-stroke-color': ringColor,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        map.getLayer?.(badgeOuterLayerId) ? badgeOuterLayerId : pointLayerId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection badge ${badgeLayerId}:`, err);
    }
  }

  // Re-apply white-core chrome when layers already exist (paint revision / theme refresh).
  if (map.setPaintProperty) {
    try {
      if (map.getLayer?.(badgeLayerId)) {
        map.setPaintProperty(badgeLayerId, 'circle-color', fillColor);
        map.setPaintProperty(badgeLayerId, 'circle-stroke-color', ringColor);
        map.setPaintProperty(badgeLayerId, 'circle-stroke-width', ringWidth);
        map.setPaintProperty(badgeLayerId, 'circle-radius', selectedRadius);
      }
      if (map.getLayer?.(badgeOuterLayerId)) {
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-color', tokens.outerStrokeColor);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-width', outerWidth);
        map.setPaintProperty(
          badgeOuterLayerId,
          'circle-radius',
          sharedPointRadiusPlusStrokeWidth(selectedRadius, ringWidth)
        );
      }
    } catch {
      /* style swap */
    }
  }
}

const selectionBadgeAnimByMap = new WeakMap<MapInstance, Map<string, number>>();
const hoverBadgeAnimByMap = new WeakMap<MapInstance, Map<string, number>>();
const hoverRingColorAnimByMap = new WeakMap<MapInstance, Map<string, number>>();

type HoverRingColorTarget = 'hover' | 'selection';

function hoverRingColorLayerId(
  pointLayerId: string,
  target: HoverRingColorTarget
): string {
  return target === 'selection'
    ? sharedPointSelectionBadgeLayerId(pointLayerId)
    : sharedPointHoverBadgeLayerId(pointLayerId);
}

function setHoverBadgeRingColor(
  map: MapInstance,
  pointLayerId: string,
  color: string,
  target: HoverRingColorTarget
): void {
  if (!map.setPaintProperty) return;
  const layerId = hoverRingColorLayerId(pointLayerId, target);
  if (!map.getLayer?.(layerId)) return;
  try {
    // Selected + unselected hover: lighten the key ring stroke (core stays white).
    map.setPaintProperty(layerId, 'circle-stroke-color', color);
  } catch {
    /* style swap */
  }
}

function cancelHoverBadgeRingColorAnimation(map: MapInstance, pointLayerId: string): void {
  const byLayer = hoverRingColorAnimByMap.get(map);
  const rafId = byLayer?.get(pointLayerId);
  if (rafId == null) return;
  cancelAnimationFrame(rafId);
  byLayer.delete(pointLayerId);
}

/** Ease badge ring between resting key color and lit hover tint. */
export function animateSharedPointHoverBadgeRingColor(
  map: MapInstance,
  pointLayerId: string,
  options: {
    from: string;
    to: string;
    target?: HoverRingColorTarget;
    durationMs?: number;
    onFrame?: (color: string) => void;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const durationMs = options.durationMs ?? tokens.hoverAnimationMs;
  const target = options.target ?? 'hover';
  const { from, to, onFrame, onDone } = options;

  cancelHoverBadgeRingColorAnimation(map, pointLayerId);
  setHoverBadgeRingColor(map, pointLayerId, from, target);
  onFrame?.(from);

  if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
    setHoverBadgeRingColor(map, pointLayerId, to, target);
    onFrame?.(to);
    onDone?.();
    return;
  }

  let byLayer = hoverRingColorAnimByMap.get(map);
  if (!byLayer) {
    byLayer = new Map();
    hoverRingColorAnimByMap.set(map, byLayer);
  }
  const anims = byLayer;
  const start = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    anims.delete(pointLayerId);
    onDone?.();
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    const color = sharedPointFloatingBadgeHoverRingColorAt(from, to, elapsed, durationMs);
    setHoverBadgeRingColor(map, pointLayerId, color, target);
    onFrame?.(color);
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    anims.set(pointLayerId, requestAnimationFrame(tick));
  };

  anims.set(pointLayerId, requestAnimationFrame(tick));
}

function selectionBadgeLayerIds(pointLayerId: string): [string, string] {
  return [
    sharedPointSelectionBadgeLayerId(pointLayerId),
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
  ];
}

function hoverBadgeLayerIds(pointLayerId: string): [string, string] {
  return [
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
  ];
}

function isZoomTranslateExpression(translate: unknown): translate is unknown[] {
  return Array.isArray(translate) && translate[0] === 'interpolate';
}

function setHoverBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  const screenTranslate = isZoomTranslateExpression(translate)
    ? translate
    : ([0, (translate as [number, number])[1]] as [number, number]);
  for (const layerId of hoverBadgeLayerIds(pointLayerId)) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setPaintProperty(layerId, 'circle-translate-anchor', 'viewport');
      map.setPaintProperty(layerId, 'circle-translate', screenTranslate);
    } catch {
      /* style swap */
    }
  }
}

function cancelHoverBadgeAnimation(map: MapInstance, pointLayerId: string): void {
  const byLayer = hoverBadgeAnimByMap.get(map);
  const rafId = byLayer?.get(pointLayerId);
  if (rafId == null) return;
  cancelAnimationFrame(rafId);
  byLayer.delete(pointLayerId);
}

/** Ease hover-overlay badge between rest and hover height. */
export function animateSharedPointHoverBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  options: {
    from: [number, number];
    to: [number, number];
    durationMs?: number;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const durationMs = options.durationMs ?? tokens.hoverAnimationMs;
  const { from, to, onDone } = options;

  cancelHoverBadgeAnimation(map, pointLayerId);
  setHoverBadgeTranslate(map, pointLayerId, from);

  if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
    setHoverBadgeTranslate(map, pointLayerId, to);
    onDone?.();
    return;
  }

  let byLayer = hoverBadgeAnimByMap.get(map);
  if (!byLayer) {
    byLayer = new Map();
    hoverBadgeAnimByMap.set(map, byLayer);
  }
  const anims = byLayer;
  const start = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    anims.delete(pointLayerId);
    onDone?.();
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    setHoverBadgeTranslate(
      map,
      pointLayerId,
      sharedPointFloatingBadgeSelectionTranslateAt(from, to, elapsed, durationMs)
    );
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    anims.set(pointLayerId, requestAnimationFrame(tick));
  };

  anims.set(pointLayerId, requestAnimationFrame(tick));
}

function setSelectionBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  // Viewport anchor + x=0 — select settle is straight down on screen toward the shadow.
  const screenTranslate = isZoomTranslateExpression(translate)
    ? translate
    : ([0, (translate as [number, number])[1]] as [number, number]);
  for (const layerId of selectionBadgeLayerIds(pointLayerId)) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setPaintProperty(layerId, 'circle-translate-anchor', 'viewport');
      map.setPaintProperty(layerId, 'circle-translate', screenTranslate);
    } catch {
      /* style swap */
    }
  }
}

function resolveBadgeTranslateAtMapZoom(map: MapInstance, maxY: number): [number, number] {
  const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 16;
  return sharedPointFloatingBadgeTranslateAtZoom(maxY, zoom);
}

function cancelSelectionBadgeAnimation(map: MapInstance, pointLayerId: string): void {
  const byLayer = selectionBadgeAnimByMap.get(map);
  const rafId = byLayer?.get(pointLayerId);
  if (rafId == null) return;
  cancelAnimationFrame(rafId);
  byLayer.delete(pointLayerId);
}

/** Ease grounded selection badge from float height down to selected (or custom from/to). */
export function animateSharedPointSelectionBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  options?: {
    from?: [number, number];
    to?: [number, number];
    durationMs?: number;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const from = options?.from ?? resolveBadgeTranslateAtMapZoom(map, tokens.floatTranslate[1]);
  const to = options?.to ?? resolveBadgeTranslateAtMapZoom(map, tokens.selectedTranslate[1]);
  const durationMs = options?.durationMs ?? tokens.selectAnimationMs;
  const onDone = options?.onDone;

  cancelSelectionBadgeAnimation(map, pointLayerId);
  setSelectionBadgeTranslate(map, pointLayerId, from);

  if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
    setSelectionBadgeTranslate(map, pointLayerId, to);
    onDone?.();
    return;
  }

  let byLayer = selectionBadgeAnimByMap.get(map);
  if (!byLayer) {
    byLayer = new Map();
    selectionBadgeAnimByMap.set(map, byLayer);
  }
  const anims = byLayer;
  const start = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    anims.delete(pointLayerId);
    onDone?.();
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    setSelectionBadgeTranslate(
      map,
      pointLayerId,
      sharedPointFloatingBadgeSelectionTranslateAt(from, to, elapsed, durationMs)
    );
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    anims.set(pointLayerId, requestAnimationFrame(tick));
  };

  anims.set(pointLayerId, requestAnimationFrame(tick));
}

function setupSelectionShadowLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  selectionShadowColor: string,
  pointRadius?: unknown,
  pointStrokeWidth?: unknown,
  selectionShadowTranslate: [number, number] = DEFAULT_SELECTION_SHADOW_TRANSLATE
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
            'circle-opacity': SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
            'circle-blur': 0.7,
            'circle-stroke-width': 0,
            'circle-translate': selectionShadowTranslate,
            'circle-pitch-alignment': 'map',
            'circle-pitch-scale': 'map',
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
  pointStrokeWidth?: unknown,
  pointTranslate?: [number, number]
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
      const ringPaint: Record<string, unknown> = {
        'circle-radius': getSelectionRingRadiusFromPointRadius(
          pointRadius ?? getPointRadiusInterpolation(),
          pointStrokeWidth ?? 0
        ),
        'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': SELECTION_RING_STROKE_WIDTH,
        'circle-stroke-color': selectionRingColor,
      };
      if (pointTranslate != null) {
        ringPaint['circle-translate'] = pointTranslate;
      }
      map.addLayer({
        id: ringLayerId,
        type: 'circle',
        source: selectionSourceId,
        minzoom: 0,
        paint: ringPaint,
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
  pointStrokeWidth?: unknown,
  options?: { hideHalo?: boolean }
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
  if (options?.hideHalo) {
    if (map.getLayer?.(ringLayerId) && map.setPaintProperty) {
      map.setPaintProperty(ringLayerId, 'circle-opacity', 0);
      map.setPaintProperty(ringLayerId, 'circle-stroke-opacity', 0);
      map.setPaintProperty(ringLayerId, 'circle-stroke-width', 0);
    }
    return;
  }

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

function featureMatchesId(
  item: GeoJSON.Feature,
  target: string,
  idProperties: string[]
): boolean {
  if (item.id != null && String(item.id) === target) return true;
  if (!item.properties) return false;
  return idProperties.some((prop) => String(item.properties?.[prop] ?? '') === target);
}

/** Read GeoJSON from a source — MapLibre/MapTiler store data under several private keys. */
function readGeoJsonSourceFeatures(source: unknown): GeoJSON.Feature[] {
  if (!source || typeof source !== 'object') return [];
  const s = source as {
    _data?: GeoJSON.FeatureCollection;
    _geojson?: GeoJSON.FeatureCollection;
    data?: GeoJSON.FeatureCollection;
    _options?: { data?: GeoJSON.FeatureCollection };
    serialize?: () => { data?: GeoJSON.FeatureCollection };
  };
  const candidates = [s._data, s._geojson, s.data, s._options?.data];
  for (const data of candidates) {
    if (data?.features?.length) return data.features;
  }
  try {
    const serialized = s.serialize?.()?.data;
    if (serialized?.features?.length) return serialized.features;
  } catch {
    /* ignore */
  }
  return [];
}

/** Canonical point coordinates from the GeoJSON source (not click lngLat). */
function lookupSharedPointFeature(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): GeoJSON.Feature | null {
  const target = String(featureId);
  const source = map.getSource?.(sourceId);
  const fromSource = readGeoJsonSourceFeatures(source).find((item) =>
    featureMatchesId(item, target, idProperties)
  );
  if (fromSource) return fromSource;

  // Worker-backed sources may not expose `_data` — fall back to queried features.
  const queried =
    (
      map as {
        querySourceFeatures?(sourceId: string, params?: unknown): GeoJSON.Feature[];
      }
    ).querySourceFeatures?.(sourceId) ?? [];
  return queried.find((item) => featureMatchesId(item, target, idProperties)) ?? null;
}

function resolveSharedPointRingColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string
): string {
  for (const key of ['_color', 'color', 'marker-color'] as const) {
    const raw = properties?.[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return fallbackColor;
}

/** Prefer annotated `_colorHover`, else lighten the resting ring toward white. */
function resolveSharedPointHoverRingColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string,
  lightenAmount = SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN
): string {
  const annotated = properties?._colorHover;
  if (typeof annotated === 'string' && annotated.trim()) return annotated.trim();
  const amount =
    typeof lightenAmount === 'number' && Number.isFinite(lightenAmount)
      ? lightenAmount
      : SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN;
  return lightenHexTowardWhite(resolveSharedPointRingColor(properties, fallbackColor), amount);
}

/**
 * Resting locker/key color for the selected badge fill.
 * Hover may have overwritten `_color` with the lit tint — prefer `_colorResting`.
 */
export function resolveFloatingBadgeSelectionKeyColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string
): string {
  const resting = properties?._colorResting;
  if (typeof resting === 'string' && resting.trim()) return resting.trim();
  const color = typeof properties?._color === 'string' ? properties._color.trim() : '';
  const hover = typeof properties?._colorHover === 'string' ? properties._colorHover.trim() : '';
  // Hover patch left `_color` equal to the lit tint — do not use it as the identity fill.
  if (color && hover && color.toLowerCase() === hover.toLowerCase()) {
    return fallbackColor.trim() || color;
  }
  if (color) return color;
  return resolveSharedPointRingColor(properties, fallbackColor);
}

export function lookupSharedPointCoords(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): { lng: number; lat: number } | null {
  const feature = lookupSharedPointFeature(map, sourceId, featureId, idProperties);
  return feature ? extractPointLngLat(feature.geometry) : null;
}

export function lookupSharedPointProperties(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  idProperties: string[] = DEFAULT_SHARED_POINT_ID_PROPERTIES
): Record<string, unknown> | null {
  const feature = lookupSharedPointFeature(map, sourceId, featureId, idProperties);
  if (!feature?.properties || typeof feature.properties !== 'object') return null;
  return { ...(feature.properties as Record<string, unknown>) };
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
  selection: {
    lngLat: { lng: number; lat: number };
    properties?: Record<string, unknown>;
    /** Feature id for hit-testing / getFeatureId on selection badge layers. */
    featureId?: string | null;
    /** Property key mirrored onto the selection feature (e.g. `venueId`). */
    promoteId?: string;
  } | null
): void {
  const selectionSourceId = `${sourceId}-selection`;
  const source = map?.getSource?.(selectionSourceId) as GeoJSONSourceWithSetData | undefined;
  if (!source?.setData) return;

  try {
    if (selection?.lngLat) {
      const featureId = selection.featureId != null ? String(selection.featureId) : undefined;
      const promoteId = selection.promoteId?.trim() || 'venueId';
      const properties: Record<string, unknown> = { ...(selection.properties ?? {}) };
      if (featureId) {
        properties[promoteId] = properties[promoteId] ?? featureId;
        if (promoteId !== 'venueId') properties.venueId = properties.venueId ?? featureId;
      }
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            ...(featureId ? { id: featureId } : {}),
            geometry: {
              type: 'Point',
              coordinates: [selection.lngLat.lng, selection.lngLat.lat],
            },
            properties,
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
  /** Glow layer id — filtered with the point when a grounded selection badge lands. */
  glowLayerId?: string;
  /** Feature property used as promoteId / filter key (e.g. `venueId`). */
  promoteId?: string;
  /** Ring stroke color when the selection layer must be mounted lazily. */
  selectionRingColor?: string;
  /** Point outline width (px) for ring radius math when mounting lazily. */
  selectionPointStrokeWidth?: number;
  /**
   * Floating-badge active state: grounded badge only — keep the halo layer
   * mounted for the selection source, but never restore its stroke.
   */
  selectionGroundBadge?: boolean;
  /** Fallback ring color for grounded selection badge layers. */
  selectionGroundBadgeFallbackColor?: string;
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
    // Floating-badge: keep selection source for the grounded badge, never paint the halo.
    ensureSharedPointSelectionRingLayer(
      map,
      sourceId,
      pointLayerId,
      selectionRingColor,
      readPointRadiusFromLayer(map, pointLayerId),
      options?.selectionPointStrokeWidth ?? 0,
      options?.selectionGroundBadge ? { hideHalo: true } : undefined
    );
    if (options?.selectionGroundBadge) {
      setupSelectionGroundBadgeLayers(map, sourceId, pointLayerId, {
        fallbackColor: options.selectionGroundBadgeFallbackColor,
      });
    }
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

/** Toggle feature-state `selected` so floating badges can hide while grounded. */
function syncSharedPointSelectedFeatureState(
  map: MapInstance,
  sourceId: string,
  previousFeatureId: string | null,
  nextFeatureId: string | null
): void {
  if (!map.setFeatureState) return;
  if (previousFeatureId && previousFeatureId !== nextFeatureId) {
    try {
      map.setFeatureState({ source: sourceId, id: previousFeatureId }, { selected: false });
    } catch {
      /* source may not support feature-state yet */
    }
  }
  if (nextFeatureId) {
    try {
      map.setFeatureState({ source: sourceId, id: nextFeatureId }, { selected: true });
    } catch {
      /* promoteId / source missing */
    }
  }
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
  const pointLayerId =
    options?.pointLayerId ?? resolveSharedPointLayerIdForSource(map, sourceId);
  const promoteId =
    options?.promoteId?.trim() ||
    options?.idProperties?.[0] ||
    DEFAULT_SHARED_POINT_ID_PROPERTIES[0] ||
    'id';
  const idProperties = [
    promoteId,
    ...(options?.idProperties ?? DEFAULT_SHARED_POINT_ID_PROPERTIES),
  ].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);

  if (!featureId || !lngLat) {
    syncSharedPointSelectedFeatureState(map, sourceId, previousFeatureId, null);
    if (pointLayerId) {
      syncSharedPointSelectedLayerFilter(map, {
        pointLayerId,
        glowLayerId: options?.glowLayerId,
        promoteId,
        featureId: null,
      });
      if (options?.selectionGroundBadge) {
        cancelSelectionBadgeAnimation(map, pointLayerId);
        setSelectionBadgeTranslate(
          map,
          pointLayerId,
          resolveSharedPointFloatingBadgeTokens().floatTranslate
        );
      }
    }
    getSharedPointSelectionMap(map).set(sourceId, { featureId: null, lngLat: null });
    updateSharedPointSelection(map, sourceId, null);
  } else {
    const resolvedLngLat =
      lookupSharedPointCoords(map, sourceId, String(featureId), idProperties) ?? lngLat;
    // Click/query props often omit `_color` — always merge the full source feature.
    const fromSource = lookupSharedPointProperties(map, sourceId, String(featureId), idProperties);
    const resolvedProperties: Record<string, unknown> = {
      ...(properties ?? {}),
      ...(fromSource ?? {}),
    };
    const fallback =
      options?.selectionGroundBadgeFallbackColor?.trim() || '#888888';
    // Hover may have washed `_color` — keep resting locker key for the ring.
    const keyColor = resolveFloatingBadgeSelectionKeyColor(resolvedProperties, fallback);
    resolvedProperties._color = keyColor;
    if (!resolvedProperties._colorResting) resolvedProperties._colorResting = keyColor;
    syncSharedPointSelectedFeatureState(map, sourceId, previousFeatureId, featureId);
    getSharedPointSelectionMap(map).set(sourceId, { featureId, lngLat: resolvedLngLat });
    ensureSelectionRingReady(map, sourceId, options);
    const selectionChanged = featureId !== previousFeatureId;
    if (options?.selectionGroundBadge && pointLayerId && selectionChanged) {
      // Land grounded badge only when selection changes — re-click must not re-jump.
      animateSharedPointSelectionBadgeTranslate(map, pointLayerId);
    }
    updateSharedPointSelection(map, sourceId, {
      lngLat: resolvedLngLat,
      featureId,
      promoteId,
      properties: resolvedProperties,
    });
    if (pointLayerId) {
      syncSharedPointSelectedLayerFilter(map, {
        pointLayerId,
        glowLayerId: options?.glowLayerId,
        promoteId,
        featureId,
      });
      // White core + key ring (same chrome as resting).
      const badgeId = sharedPointSelectionBadgeLayerId(pointLayerId);
      if (map.getLayer?.(badgeId) && map.setPaintProperty) {
        try {
          map.setPaintProperty(
            badgeId,
            'circle-color',
            resolveSharedPointFloatingBadgeTokens().fill
          );
          map.setPaintProperty(badgeId, 'circle-stroke-color', keyColor);
        } catch {
          /* style swap */
        }
      }
    }
    clearSharedPointHoverOverlay(map, sourceId);
    if (pointLayerId && !options?.selectionGroundBadge) {
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

/** Patch one feature's ring `_color` in the main GeoJSON source (in-place hover lighten). */
function patchSharedPointFeatureRingColor(
  map: MapInstance,
  sourceId: string,
  featureId: string,
  ringColor: string,
  idProperties: string[],
  options?: { restingColor?: string }
): void {
  const source = map.getSource?.(sourceId) as
    | (GeoJSONSourceWithSetData & {
        _data?: GeoJSON.FeatureCollection;
        data?: GeoJSON.FeatureCollection;
      })
    | undefined;
  if (!source?.setData) return;
  const features = readGeoJsonSourceFeatures(source);
  if (!features.length) return;
  const target = String(featureId);
  const nextFeatures = features.map((feature) => {
    if (!featureMatchesId(feature, target, idProperties)) return feature;
    const prev = feature.properties ?? {};
    const resting =
      options?.restingColor ??
      (typeof prev._colorResting === 'string' && prev._colorResting.trim()
        ? prev._colorResting.trim()
        : typeof prev._color === 'string' && prev._color.trim()
          ? prev._color.trim()
          : undefined);
    return {
      ...feature,
      properties: {
        ...prev,
        // Preserve locker identity while `_color` is temporarily lit for hover.
        ...(resting ? { _colorResting: resting } : {}),
        _color: ringColor,
      },
    };
  });
  const next: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: nextFeatures,
  };
  try {
    source.setData(next);
    if ('_data' in source) source._data = next;
    if ('data' in source) source.data = next;
  } catch {
    /* style swap */
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

type SharedPointHoverAttachment = {
  hitKey: string;
  teardown: () => void;
};

const sharedPointHoverAttachments = new WeakMap<
  object,
  Map<string, SharedPointHoverAttachment>
>();

/**
 * Attach (or refresh) hover/click handlers for shared point layers.
 * Safe to call after async layer mount — no-ops when the same hit layers are already wired.
 */
export function ensureSharedPointHoverLayers(
  map: MapInstance,
  sourceId: string,
  glowLayerId: string,
  pointLayerId: string,
  options: HoverLayerOptions = {
    glowRadius: [],
    glowColor: '#000000',
    glowBlur: 0,
    glowHoverOpacity: 0.5,
    circleColor: '#ffffff',
    pointRadius: 4,
  }
): void {
  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, options);
}

/**
 * Setup hover handlers for shared point layers.
 * Hover highlight uses feature-state on the main glow layer (same source/geometry as the dot).
 */
function setupHoverLayers(
  map: MapInstance,
  sourceId: string,
  glowLayerId: string,
  pointLayerId: string,
  options: HoverLayerOptions
): void {
  // Per-feature lift: copy hovered feature onto hover source (circle-translate is layer-wide).
  if (options.selectionGroundBadge) {
    setupFloatingBadgeHoverBadgeLayers(map, sourceId, pointLayerId, {
      fallbackColor: options.selectionGroundBadgeFallbackColor,
      glowLayerId,
    });
  }

  // Include outer stroke + grounded selection badge — they sit above the glow and
  // would otherwise swallow clicks without handlers.
  const hitLayerIds = sharedPointHitLayerIds(pointLayerId, glowLayerId).filter(
    (id, index, arr) => !!id && !!map.getLayer?.(id) && arr.indexOf(id) === index
  );
  const leaveLayerId = map.getLayer?.(glowLayerId) ? glowLayerId : pointLayerId;
  const promoteId = options.promoteId?.trim() || 'venueId';
  const idProperties = [
    options.promoteId,
    'venueId',
    ...DEFAULT_SHARED_POINT_ID_PROPERTIES,
  ].filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);
  debug.log('[layer-styles] setupHoverLayers', { hitLayerIds, leaveLayerId, sourceId });
  if (!hitLayerIds.length) {
    debug.log('[layer-styles] setupHoverLayers: no hit layers, skipping');
    return;
  }

  const hitKey = hitLayerIds.join('|');
  const mapKey = map as object;
  let bySource = sharedPointHoverAttachments.get(mapKey);
  if (!bySource) {
    bySource = new Map();
    sharedPointHoverAttachments.set(mapKey, bySource);
  }
  const previous = bySource.get(sourceId);
  if (previous?.hitKey === hitKey) {
    debug.log('[layer-styles] setupHoverLayers: already attached', { sourceId, hitKey });
    return;
  }
  previous?.teardown();

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

  /** Active hover render path — lighten only on the existing badge (no clone). */
  let hoverLiftMode: 'none' | 'overlay' | 'selection' = 'none';
  /** Feature id whose `_color` is temporarily lit (main source). */
  let hoverPatchedFeatureId: string | null = null;
  /** Invalidates in-flight fade-out clears when hover resumes. */
  let hoverRingFadeGen = 0;
  let hoverRingResting = '';
  let hoverRingLit = '';
  let hoverRingCurrent = '';
  let hoverRingLeaveRaf: number | null = null;

  function cancelHoverRingLeaveLerp(): void {
    if (hoverRingLeaveRaf == null) return;
    cancelAnimationFrame(hoverRingLeaveRaf);
    hoverRingLeaveRaf = null;
  }

  function restoreSelectionBadgeRingColor(): void {
    const badgeId = sharedPointSelectionBadgeLayerId(pointLayerId);
    const fallback = options.selectionGroundBadgeFallbackColor?.trim() || '#888888';
    if (!map.getLayer?.(badgeId) || !map.setPaintProperty) return;
    try {
      // Restore white core + key ring after hover lighten.
      map.setPaintProperty(
        badgeId,
        'circle-color',
        resolveSharedPointFloatingBadgeTokens().fill
      );
      map.setPaintProperty(badgeId, 'circle-stroke-color', [
        'coalesce',
        ['get', '_color'],
        ['get', 'color'],
        ['get', 'marker-color'],
        fallback,
      ]);
    } catch {
      /* style swap */
    }
  }

  function clearHoverOverlayNow(): void {
    if (hoverLiftMode === 'none') return;
    const mode = hoverLiftMode;
    const resting = hoverRingResting || '#888888';
    const from = hoverRingCurrent || hoverRingLit || resting;
    const patchedId = hoverPatchedFeatureId;
    const gen = ++hoverRingFadeGen;
    hoverLiftMode = 'none';
    hoverPatchedFeatureId = null;
    cancelHoverRingLeaveLerp();
    clearSharedPointHoverOverlay(map, sourceId);

    if (mode === 'selection') {
      animateSharedPointHoverBadgeRingColor(map, pointLayerId, {
        from,
        to: resting,
        target: 'selection',
        onFrame: (color) => {
          hoverRingCurrent = color;
        },
        onDone: () => {
          if (gen !== hoverRingFadeGen) return;
          restoreSelectionBadgeRingColor();
          hoverRingCurrent = resting;
        },
      });
      return;
    }

    // Unselected: lerp `_color` on the same feature, then restore resting.
    if (patchedId == null) {
      hoverRingCurrent = resting;
      return;
    }
    const tokens = resolveSharedPointFloatingBadgeTokens();
    const durationMs = tokens.hoverAnimationMs;
    if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
      patchSharedPointFeatureRingColor(map, sourceId, patchedId, resting, idProperties);
      hoverRingCurrent = resting;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      if (gen !== hoverRingFadeGen) return;
      const elapsed = now - start;
      const color = sharedPointFloatingBadgeHoverRingColorAt(from, resting, elapsed, durationMs);
      hoverRingCurrent = color;
      patchSharedPointFeatureRingColor(map, sourceId, patchedId, color, idProperties);
      if (elapsed >= durationMs) {
        hoverRingLeaveRaf = null;
        patchSharedPointFeatureRingColor(map, sourceId, patchedId, resting, idProperties);
        hoverRingCurrent = resting;
        return;
      }
      hoverRingLeaveRaf = requestAnimationFrame(tick);
    };
    hoverRingLeaveRaf = requestAnimationFrame(tick);
  }

  function lightExistingBadgeRing(feature: Feature, featureId: string): void {
    // Restore any previously lit feature before lighting the new one.
    if (
      hoverPatchedFeatureId != null &&
      hoverPatchedFeatureId !== featureId &&
      hoverRingResting
    ) {
      patchSharedPointFeatureRingColor(
        map,
        sourceId,
        hoverPatchedFeatureId,
        hoverRingResting,
        idProperties
      );
    }
    // queryRenderedFeatures often drops paint props (`_color`); look up the full feature.
    const fromSource = lookupSharedPointProperties(map, sourceId, featureId, idProperties);
    const properties = {
      ...(feature.properties ?? {}),
      ...(fromSource ?? {}),
      [promoteId]: featureId,
    };
    const fallback = options.selectionGroundBadgeFallbackColor?.trim() || '#888888';
    // If we already lit this feature, prefer the stored resting color (not the lit `_color`).
    const restingColor =
      hoverPatchedFeatureId === featureId && hoverRingResting
        ? hoverRingResting
        : resolveSharedPointRingColor(properties, fallback);
    const litColor = resolveSharedPointHoverRingColor(
      { ...properties, _color: restingColor },
      fallback,
      resolveSharedPointFloatingBadgeTokens().hoverLighten
    );
    hoverRingFadeGen += 1;
    cancelHoverRingLeaveLerp();
    clearSharedPointHoverOverlay(map, sourceId);
    hoverRingResting = restingColor;
    hoverRingLit = litColor;
    hoverRingCurrent = litColor;
    hoverPatchedFeatureId = featureId;
    patchSharedPointFeatureRingColor(map, sourceId, featureId, litColor, idProperties, {
      restingColor,
    });
  }

  function setFloatingBadgeHoverFeature(
    feature: Feature | null,
    featureId: string | null
  ): void {
    if (!options.selectionGroundBadge) return;
    const selectedId = getSharedPointSelection(map, sourceId)?.featureId ?? null;

    if (!feature || featureId == null) {
      if (hoverLiftMode === 'none') return;
      clearHoverOverlayNow();
      return;
    }

    // Selected badge: lighten only — do not raise/lower from selected height.
    if (selectedId != null && featureId === selectedId) {
      cancelHoverBadgeAnimation(map, pointLayerId);
      cancelHoverRingLeaveLerp();
      clearSharedPointHoverOverlay(map, sourceId);
      if (hoverPatchedFeatureId != null && hoverRingResting) {
        patchSharedPointFeatureRingColor(
          map,
          sourceId,
          hoverPatchedFeatureId,
          hoverRingResting,
          idProperties
        );
        hoverPatchedFeatureId = null;
      }
      const fromSource = lookupSharedPointProperties(map, sourceId, featureId, idProperties);
      const fallback = options.selectionGroundBadgeFallbackColor?.trim() || '#888888';
      const merged = { ...(feature.properties ?? {}), ...(fromSource ?? {}) };
      const restingColor = resolveSharedPointRingColor(merged, fallback);
      const litColor = resolveSharedPointHoverRingColor(
        merged,
        fallback,
        resolveSharedPointFloatingBadgeTokens().hoverLighten
      );
      hoverRingFadeGen += 1;
      hoverRingResting = restingColor;
      hoverRingLit = litColor;
      hoverLiftMode = 'selection';
      animateSharedPointHoverBadgeRingColor(map, pointLayerId, {
        from: litColor,
        to: litColor,
        target: 'selection',
        durationMs: 0,
        onFrame: (color) => {
          hoverRingCurrent = color;
        },
      });
      return;
    }

    cancelHoverBadgeAnimation(map, pointLayerId);
    hoverLiftMode = 'overlay';
    lightExistingBadgeRing(feature, featureId);
  }

  function finalizeHoverChrome(): void {
    clearHoverFeatureState();
    setCursor('');
    dispatchHoverEnd();
  }

  function endHover(): void {
    // Instant stop: reverse the ring color now; chrome can settle with the leave debounce.
    if (hoverLiftMode !== 'none') {
      clearHoverOverlayNow();
    }
    finalizeHoverChrome();
  }

  /** Coordinate key of the feature currently under the cursor (mousemove dedup). */
  let currentHoverKey: string | null = null;
  /** Debounce leave chrome across overlapping hit layers (point ↔ outer ↔ glow). */
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelScheduledLeave(): void {
    if (leaveTimer == null) return;
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }

  function scheduleEndHover(): void {
    // Color reverse starts immediately — debounce only gates cursor/feature-state teardown.
    if (hoverLiftMode !== 'none') {
      clearHoverOverlayNow();
    }
    cancelScheduledLeave();
    leaveTimer = setTimeout(() => {
      leaveTimer = null;
      currentHoverKey = null;
      finalizeHoverChrome();
    }, 40);
  }

  function onMouseMove(e: {
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
  }): void {
    const features = e?.features;
    if (!features?.length) {
      if (currentHoverKey !== null) {
        scheduleEndHover();
      }
      return;
    }

    cancelScheduledLeave();
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

    const featureForId = {
      type: 'Feature',
      id: (f as { id?: string | number })?.id,
      properties: f?.properties ?? {},
      geometry,
    } as Feature;
    const featureId = getFeatureId(featureForId, idProperties);
    const featureIdKey = featureId != null ? String(featureId) : null;

    if (key === currentHoverKey) return;

    currentHoverKey = key;
    setFloatingBadgeHoverFeature(featureForId, featureIdKey);

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
    // Floated badge sits above the glow — leave must fire on point/outer too, not only glow.
    scheduleEndHover();
  }

  // Click handler: move selection ring, then dispatch gk-point-click from the gk-map element.
  // Single hit layer means no glow+point double-fire, but keep cooldown for safety.
  let lastClickTime = 0;
  function onClick(e: {
    features?: Array<{
      geometry?: unknown;
      properties?: Record<string, unknown>;
      id?: string | number;
    }>;
    lngLat?: { lng: number; lat: number };
    originalEvent?: Event;
  }): void {
    const features = e?.features;
    if (!features?.length) return;

    const f = features[0];
    const geometry = f?.geometry;

    const mapEl = findMapElement();
    const featureForId = {
      type: 'Feature',
      id: f?.id,
      properties: f?.properties ?? {},
      geometry: geometry ?? { type: 'Point', coordinates: [0, 0] },
    } as Feature;
    const featureId = getFeatureId(featureForId, idProperties);
    // Empty selection-source hits must not consume the dedup window — let glow/point handle it.
    if (featureId == null) return;

    const now = Date.now();
    if (now - lastClickTime < 50) return; // dedup glow+point double-fire
    lastClickTime = now;
    endHover();
    const lngLat = resolveSharedPointSelectionLngLat(
      map,
      sourceId,
      String(featureId),
      geometry,
      e.lngLat ? { lng: e.lngLat.lng, lat: e.lngLat.lat } : null,
      idProperties
    );

    if (lngLat) {
      setSharedPointSelection(
        map,
        sourceId,
        {
          featureId,
          lngLat,
          // Incomplete query props are fine — setSharedPointSelection merges source `_color`.
          properties: f?.properties ?? {},
        },
        {
          mapElement: mapEl,
          dispatchEvent: true,
          pointLayerId,
          promoteId: options.promoteId ?? idProperties[0],
          idProperties,
          selectionGroundBadge: options.selectionGroundBadge,
          selectionGroundBadgeFallbackColor: options.selectionGroundBadgeFallbackColor,
          selectionPointStrokeWidth: options.selectionPointStrokeWidth,
          selectionRingColor: options.selectionRingColor,
        }
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

  // Click/move on all hit layers; mouseleave on each so floated badges restore when the
  // pointer leaves the raised badge (glow stays on the ground and would miss the leave).
  try {
    for (const layerId of hitLayerIds) {
      map.on('mousemove', layerId, onMouseMove as any);
      map.on('click', layerId, onClick as any);
      map.on('mouseleave', layerId, onMouseLeave as any);
    }
    const teardown = () => {
      cancelScheduledLeave();
      cancelHoverBadgeAnimation(map, pointLayerId);
      cancelHoverBadgeRingColorAnimation(map, pointLayerId);
      for (const layerId of hitLayerIds) {
        map.off?.('mousemove', layerId, onMouseMove as any);
        map.off?.('click', layerId, onClick as any);
        map.off?.('mouseleave', layerId, onMouseLeave as any);
      }
      bySource.delete(sourceId);
    };
    bySource.set(sourceId, { hitKey, teardown });
    debug.log('[layer-styles] attached mousemove+click+leave handlers', hitLayerIds);
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
