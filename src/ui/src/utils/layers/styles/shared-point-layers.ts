/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../../../providers/types';
import type { Feature } from '@doppler-group/geokit/core/types';
import { getFeatureId } from '@doppler-group/geokit/core/geojson';
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
  sharedPointFloatingBadgeRadiusExpression,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
  lightenHexTowardWhite,
  sharedPointFloatingBadgeGlassRadiusExpression,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeSelectionTranslateAt,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeTranslatesNearlyEqual,
  sharedPointGlassLayerId,
  sharedPointHitLayerIds,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointOuterStrokeLayerId,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointGlassPaint,
  sharedPointRestingOuterStrokeWidth,
  sharedPointSelectedMiddleRingColor,
  sharedPointZoomedOutStep,
  sharedPointFloatingBadgeSelectionFillExpression,
  resolveFloatingBadgeSelectionKeyColor,
  resolveFloatingBadgeSelectionAccentColor,
  SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
  syncSharedPointSelectedLayerFilter,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
} from '../../paint/shared-point-paint';
import {
  sharedPointBadgeVariantFromProperties,
  syncBadgeChrome,
} from '../../markers/badge';
import { sharedPointCircleBodyFilter, trySetLayerFilter } from '../../markers/marker-shape';
import { ensureFloatingBadgeSelectionChrome } from '../../markers/marker-selection-chrome';
import {
  ensureSharedPointBadgeIconLayers,
  syncBadgeIconTranslate,
  raiseSharedPointBadgeIconLayersOnTop,
  SHARED_POINT_BADGE_ICON_PROPERTY,
  syncSelectionBadgeIconTranslate,
  sharedPointSelectionBadgeIconLayerId,
} from '../../paint/shared-point-badge-icon';
import { resolveSharedPointLayerIdForSource } from '../../shared-points/shared-point-heal';
import {
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
  sharedPointSelectionRoundedRingLayerId,
} from '../../paint/shared-point-rounded-body';

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
import {
  DEFAULT_SELECTION_SHADOW_TRANSLATE,
  getSelectionRingRadiusFromPointRadius,
  resolveEffectivePointRadius,
  resolveSharedPointFeatureStateHoverPaint,
  MAPTILER_POINT_RADIUS_ZOOM,
} from './shared-point/sizing';
import {
  animateSharedPointHoverBadgeTranslate,
  animateSharedPointSelectionBadgeTranslate,
  cancelHoverBadgeAnimation,
  cancelHoverBadgeRingColorAnimation,
  cancelSelectionBadgeAnimation,
} from './shared-point/badge-translate';
import { EMPTY_GEOJSON } from './shared-point/geojson';
import {
  clearSharedPointHoverOverlay,
  DEFAULT_SHARED_POINT_ID_PROPERTIES,
  extractPointLngLat,
  getSharedPointSelection,
  lookupSharedPointProperties,
  patchSharedPointFeatureRingColor,
  resolveSharedPointHoverRingColor,
  resolveSharedPointRingColor,
  resolveSharedPointSelectionLngLat,
  setSharedPointSelection,
} from './shared-point/selection';

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

type SharedPointGlowLayerConfig = {
  map: MapInstance;
  sourceId: string;
  glowLayerId: string;
  pointLayerId: string;
  baseGlowRadius: unknown[] | number;
  resolvedGlowColor: string | unknown[];
  glowBlur: number | unknown[] | undefined;
  hoverPaint: ReturnType<typeof resolveSharedPointFeatureStateHoverPaint>;
  glowOpacity: number | unknown[] | undefined;
  filter?: unknown[];
  beforeLayerId?: string;
  glowTranslate?: [number, number] | unknown[];
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
    pointTranslate?: [number, number] | unknown[];
    selectionShadowTranslate: [number, number] | unknown[];
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

  // Floating-badge active state = lifted badge + softer ground shadow (no halo ring).
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
    // Still need the empty selection source for the lifted badge feature.
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
      tokens.selectedShadowTranslate
    );
    const shadowLayerId = `${pointLayerId}-selection-shadow`;
    if (map.getLayer?.(shadowLayerId) && map.setPaintProperty) {
      try {
        map.setPaintProperty(shadowLayerId, 'circle-radius', selectedShadowRadius);
        map.setPaintProperty(shadowLayerId, 'circle-opacity', tokens.selectedShadowOpacity);
        map.setPaintProperty(shadowLayerId, 'circle-blur', tokens.selectedShadowBlur);
        map.setPaintProperty(shadowLayerId, 'circle-color', tokens.shadowColor);
        map.setPaintProperty(shadowLayerId, 'circle-translate', tokens.selectedShadowTranslate);
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
  glowBlur: number | unknown[];
  glowHoverOpacity?: number | unknown[];
  circleColor: string | unknown[];
  pointRadius: unknown;
  /** promoteId / primary feature id property (e.g. `venueId`). */
  promoteId?: string;
  /** Keep selection halo off when grounded floating-badge is active. */
  selectionGroundBadge?: boolean;
  selectionGroundBadgeFallbackColor?: string;
  selectionPointStrokeWidth?: number | unknown[];
  selectionRingColor?: string;
  /** Resting badge translate (floating-badge). Zoom expression or `[x, y]`. */
  floatTranslate?: [number, number] | unknown[];
  /** Hover badge translate — slightly higher so the ground shadow reads smaller. */
  hoverTranslate?: [number, number] | unknown[];
  /** Selected badge translate — restore target when leaving hover on a selected point. */
  selectedTranslate?: [number, number] | unknown[];
}

export {
  EMPTY_GEOJSON,
  type GeoJSONSourceWithSetData,
  extractPointLngLat,
} from './shared-point/geojson';

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
    /** Zoomed-out glow color (key color); defaults to `glassColor`. */
    glowColor?: unknown;
    pointRadius?: unknown;
    ringWidth?: number | unknown[];
    glassOpacity?: number;
    glassBlur?: number;
    filter?: unknown[];
    pointTranslate?: [number, number] | unknown[];
  }
): void {
  const glassLayerId = sharedPointGlassLayerId(pointLayerId);
  if (map.getLayer?.(glassLayerId)) return;

  const paint: Record<string, unknown> = {
    ...sharedPointGlassPaint({
      glassRadius: options.glassRadius,
      glassColor: options.glassColor,
      glowColor: options.glowColor ?? options.glassColor,
      pointRadius: options.pointRadius ?? sharedPointFloatingBadgeRadiusExpression(),
      ringWidth: options.ringWidth ?? 0,
      glassOpacity: options.glassOpacity,
      glassBlur: options.glassBlur,
    }),
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
 * Outer band: fill plugs the seam under the colored ring; circle-stroke draws the
 * smooth visible rim (filled-only outer edges look pixelated at large radii).
 * Drawn below the point layer.
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
  const radius = sharedPointFloatingBadgeOuterStrokeRadius(
    options.pointRadius,
    ringForRadius
  );
  const opacity = options.outerStrokeOpacity ?? 1;
  const paint: Record<string, unknown> = {
    'circle-radius': radius,
    'circle-color': sharedPointZoomedOutStep('rgba(0,0,0,0)', options.outerStrokeColor),
    'circle-opacity': opacity,
    'circle-blur': 0,
    'circle-stroke-width': sharedPointRestingOuterStrokeWidth(options.outerStrokeWidth),
    'circle-stroke-color': options.outerStrokeColor,
    'circle-stroke-opacity': opacity,
  };
  if (options.pointTranslate != null) {
    paint['circle-translate'] = options.pointTranslate;
    paint['circle-translate-anchor'] = 'viewport';
  }

  if (map.getLayer?.(outerStrokeLayerId)) {
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
  const fallbackColor = options?.fallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
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
  const badgeRadius = sharedPointFloatingBadgeRadiusExpression();
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

  // Seam-plug fill + stroked rim under core+ring (same beforeId, outer first).
  const hoverBadgeBeforeId = pointLayerId;
  const hoverOuterRadius = sharedPointFloatingBadgeOuterStrokeRadius(badgeRadius, ringWidth);
  if (!map.getLayer?.(badgeOuterLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeOuterLayerId,
          type: 'circle',
          source: hoverSourceId,
          minzoom: 0,
          paint: {
            'circle-radius': hoverOuterRadius,
            'circle-color': tokens.outerStrokeColor,
            'circle-opacity': tokens.outerStrokeOpacity,
            'circle-blur': 0,
            'circle-stroke-width': outerWidth,
            'circle-stroke-color': tokens.outerStrokeColor,
            'circle-stroke-opacity': tokens.outerStrokeOpacity,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        hoverBadgeBeforeId
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
        hoverBadgeBeforeId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add hover badge ${badgeLayerId}:`, err);
    }
  } else if (map.setPaintProperty) {
    try {
      map.setPaintProperty(badgeLayerId, 'circle-translate', tokens.floatTranslate);
      map.setPaintProperty(badgeLayerId, 'circle-translate-anchor', 'viewport');
      if (map.getLayer?.(badgeOuterLayerId)) {
        map.setPaintProperty(badgeOuterLayerId, 'circle-radius', hoverOuterRadius);
        map.setPaintProperty(badgeOuterLayerId, 'circle-color', tokens.outerStrokeColor);
        map.setPaintProperty(badgeOuterLayerId, 'circle-opacity', tokens.outerStrokeOpacity);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-width', outerWidth);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-color', tokens.outerStrokeColor);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-opacity', tokens.outerStrokeOpacity);
        map.setPaintProperty(badgeOuterLayerId, 'circle-translate', tokens.floatTranslate);
        map.setPaintProperty(badgeOuterLayerId, 'circle-translate-anchor', 'viewport');
      }
    } catch {
      /* style swap */
    }
  }
}

/**
 * Selection badge on the selection source (lifts above the map when selected).
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
  const fallbackColor = options?.fallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
  const tokens = resolveSharedPointFloatingBadgeTokens();
  // Selected: darkened key core + white middle ring + darkened key outer.
  const fillColor = sharedPointFloatingBadgeSelectionFillExpression(fallbackColor);
  const outerColor = fillColor;
  const middleRingColor = sharedPointSelectedMiddleRingColor(fillColor, tokens.fill);

  if (!map.getSource?.(selectionSourceId)) return;

  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth);
  const outerWidth = sharedPointFloatingBadgeOuterStrokeWidthExpression(
    tokens.outerStrokeWidth
  );

  // Softer ground shadow under the lifted selected badge (main glow is filtered away).
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
    tokens.selectedShadowTranslate
  );
  const shadowLayerId = `${pointLayerId}-selection-shadow`;
  if (map.getLayer?.(shadowLayerId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(shadowLayerId, 'circle-radius', selectedShadowRadius);
      map.setPaintProperty(shadowLayerId, 'circle-opacity', tokens.selectedShadowOpacity);
      map.setPaintProperty(shadowLayerId, 'circle-blur', tokens.selectedShadowBlur);
      map.setPaintProperty(shadowLayerId, 'circle-color', tokens.shadowColor);
      map.setPaintProperty(
        shadowLayerId,
        'circle-translate',
        tokens.selectedShadowTranslate
      );
      map.setPaintProperty(shadowLayerId, 'circle-pitch-alignment', 'map');
      map.setPaintProperty(shadowLayerId, 'circle-pitch-scale', 'map');
    } catch {
      /* ignore */
    }
  }

  // Seam-plug fill + stroked key rim under core + white ring (same beforeId, outer first).
  const selectionBadgeBeforeId = map.getLayer?.(`${pointLayerId}-selection-ring`)
    ? `${pointLayerId}-selection-ring`
    : pointLayerId;
  const selectionIconLayerId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
  const insertBelowId = map.getLayer?.(selectionIconLayerId)
    ? selectionIconLayerId
    : selectionBadgeBeforeId;
  const outerStrokeRadius = sharedPointFloatingBadgeOuterStrokeRadius(
    selectedRadius,
    ringWidth
  );
  if (!map.getLayer?.(badgeOuterLayerId)) {
    try {
      map.addLayer(
        {
          id: badgeOuterLayerId,
          type: 'circle',
          source: selectionSourceId,
          filter: sharedPointCircleBodyFilter(),
          minzoom: 0,
          paint: {
            'circle-radius': outerStrokeRadius,
            'circle-color': outerColor,
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': outerWidth,
            'circle-stroke-color': outerColor,
            'circle-stroke-opacity': 1,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        insertBelowId
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
          filter: sharedPointCircleBodyFilter(),
          minzoom: 0,
          paint: {
            'circle-radius': selectedRadius,
            'circle-color': fillColor,
            'circle-opacity': 1,
            'circle-blur': 0,
            'circle-stroke-width': ringWidth,
            'circle-stroke-color': middleRingColor,
            'circle-translate': tokens.floatTranslate,
            'circle-translate-anchor': 'viewport',
          },
        } as any,
        insertBelowId
      );
    } catch (err) {
      console.error(`[gk-layer-styles] Failed to add selection badge ${badgeLayerId}:`, err);
    }
  }

  const circleOnlyFilter = sharedPointCircleBodyFilter();
  for (const layerId of [badgeLayerId, badgeOuterLayerId, shadowLayerId]) {
    trySetLayerFilter(map, layerId, circleOnlyFilter);
  }

  // Re-apply key-core chrome when layers already exist (paint revision / theme refresh).
  if (map.setPaintProperty) {
    try {
      if (map.getLayer?.(badgeLayerId)) {
        map.setPaintProperty(badgeLayerId, 'circle-color', fillColor);
        map.setPaintProperty(badgeLayerId, 'circle-stroke-color', middleRingColor);
        map.setPaintProperty(badgeLayerId, 'circle-stroke-width', ringWidth);
        map.setPaintProperty(badgeLayerId, 'circle-radius', selectedRadius);
      }
      if (map.getLayer?.(badgeOuterLayerId)) {
        map.setPaintProperty(badgeOuterLayerId, 'circle-color', outerColor);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-color', outerColor);
        map.setPaintProperty(badgeOuterLayerId, 'circle-opacity', 1);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-opacity', 1);
        map.setPaintProperty(badgeOuterLayerId, 'circle-stroke-width', outerWidth);
        map.setPaintProperty(badgeOuterLayerId, 'circle-radius', outerStrokeRadius);
      }
      // Heal sessions that still have outer above the white ring.
      if (
        map.getLayer?.(badgeOuterLayerId) &&
        map.getLayer?.(badgeLayerId) &&
        typeof map.moveLayer === 'function'
      ) {
        map.moveLayer(badgeOuterLayerId, badgeLayerId);
      }
    } catch {
      /* style swap */
    }
  }

  raiseSharedPointBadgeIconLayersOnTop(map, pointLayerId);
}


function setupSelectionShadowLayer(
  map: MapInstance,
  sourceId: string,
  pointLayerId: string,
  selectionShadowColor: string,
  pointRadius?: unknown,
  pointStrokeWidth?: unknown,
  selectionShadowTranslate: [number, number] | unknown[] = DEFAULT_SELECTION_SHADOW_TRANSLATE
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
          filter: sharedPointCircleBodyFilter(),
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
  pointTranslate?: [number, number] | unknown[]
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
    // Floating badge: halo only when zoomed out (white ring with a gap around the dot).
    if (map.getLayer?.(ringLayerId) && map.setPaintProperty) {
      const tokens = resolveSharedPointFloatingBadgeTokens();
      const selectedDot = sharedPointRadiusPlusStrokeWidth(
        sharedPointFloatingBadgeSelectedRadiusExpression(),
        sharedPointFloatingBadgeRingWidthExpression(tokens.selectedRingWidth)
      );
      map.setPaintProperty(ringLayerId, 'circle-radius', getSelectionRingRadiusFromPointRadius(selectedDot) as never);
      map.setPaintProperty(ringLayerId, 'circle-opacity', 0);
      map.setPaintProperty(ringLayerId, 'circle-stroke-color', selectionRingColor);
      map.setPaintProperty(ringLayerId, 'circle-stroke-opacity', sharedPointZoomedOutStep(1, 0));
      map.setPaintProperty(
        ringLayerId,
        'circle-stroke-width',
        sharedPointZoomedOutStep(SELECTION_RING_STROKE_WIDTH, 0)
      );
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
  let hoverLiftMode: 'none' | 'overlay' = 'none';
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

  function clearHoverOverlayNow(): void {
    if (hoverLiftMode === 'none') return;
    const resting = hoverRingResting || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
    const from = hoverRingCurrent || hoverRingLit || resting;
    const patchedId = hoverPatchedFeatureId;
    const gen = ++hoverRingFadeGen;
    hoverLiftMode = 'none';
    hoverPatchedFeatureId = null;
    cancelHoverRingLeaveLerp();
    clearSharedPointHoverOverlay(map, sourceId);

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
    const fallback = options.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
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
      // Selected keeps its intensified key color — hover never washes it toward white.
      hoverRingFadeGen += 1;
      hoverLiftMode = 'none';
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

export * from './shared-point/sizing';
export * from './shared-point/badge-translate';
export * from './shared-point/selection';
