/** Sizing, radius, and hover-paint helpers. */
import type { MapInstance } from '../../../../providers/types';
import type { Feature } from '@local-hosting/geokit/core/types';
import { getFeatureId } from '@local-hosting/geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../../map-surface/theme';
import { debug } from '../../../map-surface/logger';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../../map-surface/feature-state-hover';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
  literalNumberFromPaintExpression,
  resolveSharedPointFloatingBadgeTokens,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
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
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
  sharedPointFloatingBadgeSelectionFillExpression,
  resolveFloatingBadgeSelectionKeyColor,
  resolveFloatingBadgeSelectionAccentColor,
  SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
  syncSharedPointSelectedLayerFilter,
} from '../../../paint/shared-point-paint';
import {
  sharedPointBadgeVariantFromProperties,
  syncBadgeChrome,
} from '../../../markers/badge';
import { sharedPointCircleBodyFilter, trySetLayerFilter } from '../../../markers/marker-shape';
import { ensureFloatingBadgeSelectionChrome } from '../../../markers/marker-selection-chrome';
import {
  ensureSharedPointBadgeIconLayers,
  syncBadgeIconTranslate,
  raiseSharedPointBadgeIconLayersOnTop,
  SHARED_POINT_BADGE_ICON_PROPERTY,
  syncSelectionBadgeIconTranslate,
  sharedPointSelectionBadgeIconLayerId,
} from '../../../paint/shared-point-badge-icon';
import { resolveSharedPointLayerIdForSource } from '../../../shared-points/shared-point-heal';
import {
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
  sharedPointSelectionRoundedRingLayerId,
} from '../../../paint/shared-point-rounded-body';

// ============================================================================
// Types
// ============================================================================

import type { SharedPointLayersConfig, CircleStyleOptions } from '../types';
import {
  getPointRadiusInterpolation, getGlowRadiusInterpolation, SELECTION_RING_STROKE_WIDTH, SELECTION_RING_GAP_PX,
} from '../circle-glow';
import { offsetRadiusInterpolation } from '../category-expressions';
import { omitNil } from '../circle-glow';
import {
  resolveGlowBlur, resolveGlowOpacity, resolveSharedGlowColor, resolveDefaultLayerColor, resolveDefaultStrokeColor,
  resolveMapTilerHelperPointColor,
} from '../types';
export const MAPTILER_POINT_RADIUS_ZOOM: Array<{ zoom: number; value: number }> = [
  { zoom: 0, value: 3 },
  { zoom: 2, value: 3 },
  { zoom: 6, value: 2.8 },
  { zoom: 10, value: 4.35 },
  { zoom: 14, value: 6 },
  { zoom: 18, value: 9 },
];

export function maptilerPointRadiusInterpolation(): unknown[] {
  const expr: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const stop of MAPTILER_POINT_RADIUS_ZOOM) {
    expr.push(stop.zoom, stop.value);
  }
  return expr;
}

export function resolveEffectivePointRadius(
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
export function resolveSharedPointFeatureStateHoverPaint(
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
export const DEFAULT_SELECTION_SHADOW_TRANSLATE: [number, number] = [2, 2];
