/**
 * MapLibre paint/layout expressions for shared point layers.
 *
 * Prefer pre-computing colors on feature properties (_color) and using simple
 * coalesce/get expressions — complex data-driven paint causes MapTiler to drop
 * features at low zoom when per-tile rendering budgets are exceeded.
 */

import type { MapInstance } from '../providers/types';
import {
  buildOpacityWithHoverExpression,
  HOVER_CONFIG,
  scaleRadiusForHover,
} from './feature-state-hover';

/** Min point radius (px). Safari needs ≥2px or circles can vanish when zoomed out. */
export const SHARED_POINT_MIN_RADIUS_PX = 2.8;

/** Default glow opacity for shared point layers. */
export const SHARED_POINT_UNIFORM_GLOW_OPACITY = 0.24;

/** Soft edge for glow halos (higher = more fade at edge). */
export const SHARED_POINT_GLOW_BLUR = 1.5;

/** Scale glow radius vs point radius for a larger click/hover hit area. */
export const SHARED_POINT_GLOW_HIT_AREA_SCALE = 2.5;

/** Default glow hover opacity when the app does not pass a theme-specific value. */
export const SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY = 0.35;

/** Non-primary values render slightly smaller when using brand-based radius scaling. */
export const SHARED_POINT_SECONDARY_RADIUS_SCALE = 0.9;

/** Point radius by zoom — slightly larger at high zoom for visibility. */
export const SHARED_POINT_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  0,
  SHARED_POINT_MIN_RADIUS_PX,
  2,
  SHARED_POINT_MIN_RADIUS_PX,
  6,
  SHARED_POINT_MIN_RADIUS_PX,
  10,
  2.6,
  14,
  3.8,
  18,
  6,
];

/** Hover glow radius — uniform for all features. */
export const SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  0,
  4,
  6,
  8,
  10,
  12,
  14,
  18,
  18,
  26,
];

export function paintColorFromProperty(property = '_color', fallback = '#888888'): unknown[] {
  return ['coalesce', ['get', property], fallback];
}

export function sharedPointRadiusByPropertyExpression(
  property: string,
  primaryValue: string,
  secondaryScale = SHARED_POINT_SECONDARY_RADIUS_SCALE
): unknown[] {
  if (!primaryValue) {
    return SHARED_POINT_RADIUS_EXPRESSION;
  }
  return [
    '*',
    SHARED_POINT_RADIUS_EXPRESSION,
    ['case', ['==', ['get', property], ['literal', primaryValue]], 1, secondaryScale],
  ];
}

export function sharedPointColorExpression(options: {
  colorProperty?: string;
  colorFallback?: string;
  primaryProperty?: string;
  primaryValue?: string;
  primaryFillColor?: string;
  hasSecondaryValues?: boolean;
}): unknown[] {
  const {
    colorProperty = '_color',
    colorFallback = '#888888',
    primaryProperty = 'brand',
    primaryValue = '',
    primaryFillColor = '#ffffff',
    hasSecondaryValues = false,
  } = options;

  const base = paintColorFromProperty(colorProperty, colorFallback);
  if (!hasSecondaryValues || !primaryValue) {
    return base;
  }
  return [
    'case',
    ['==', ['get', primaryProperty], ['literal', primaryValue]],
    primaryFillColor,
    base,
  ];
}

export function circleSortKeyByProperty(property: string, value: string): unknown[] {
  if (!value) {
    return ['literal', 0];
  }
  return ['case', ['==', ['get', property], ['literal', value]], 1, 0];
}

export function sharedPointStrokeWidthExpression(): unknown[] {
  return ['literal', 0];
}

export function sharedPointStrokeColorExpression(): unknown[] {
  return ['literal', 'rgba(0,0,0,0)'];
}

export interface SharedPointLayerIds {
  sourceId: string;
  glowLayerId: string;
  pointLayerId: string;
}

export interface SharedPointFeatureStateHoverOptions {
  glowRadius: unknown[] | number;
  glowOpacity: number;
  pointOpacity: number;
  glowHoverOpacity: number;
}

export interface SharedPointFeatureStateHoverPaint {
  glowRadius: unknown[] | number;
  glowOpacity: unknown[];
  pointOpacity: unknown[];
  pointStrokeWidth: unknown[];
  pointStrokeColor: unknown[];
}

/** Build MapLibre paint values for shared point feature-state hover. */
export function buildSharedPointFeatureStateHoverPaint(
  options: SharedPointFeatureStateHoverOptions
): SharedPointFeatureStateHoverPaint {
  const { glowRadius, glowOpacity, pointOpacity, glowHoverOpacity } = options;
  return {
    glowRadius: scaleRadiusForHover(glowRadius),
    glowOpacity: buildOpacityWithHoverExpression(glowOpacity, glowHoverOpacity),
    pointOpacity: buildOpacityWithHoverExpression(pointOpacity, HOVER_CONFIG.pointOpacity),
    pointStrokeWidth: buildOpacityWithHoverExpression(0, HOVER_CONFIG.pointStrokeWidth),
    pointStrokeColor: buildOpacityWithHoverExpression(
      'rgba(0,0,0,0)',
      HOVER_CONFIG.pointStrokeColor
    ),
  };
}

export interface ApplySharedPointPaintOptions {
  ids: SharedPointLayerIds;
  pointColorExpression: unknown[];
  pointRadiusExpression: unknown[];
  glowColorExpression?: unknown[];
  glowOpacity?: number;
  primarySortProperty?: string;
  primarySortValue?: string;
  strokeWidthExpression?: unknown[];
  strokeColorExpression?: unknown[];
  /** When set, glow/point layers use feature-state hover paint expressions. */
  featureStateHover?: SharedPointFeatureStateHoverOptions;
}

/** Apply paint/layout overrides to an existing shared point layer set. */
export function applySharedPointLayerPaint(
  map: MapInstance,
  options: ApplySharedPointPaintOptions
): void {
  const {
    ids: { glowLayerId, pointLayerId },
    pointColorExpression,
    pointRadiusExpression,
    glowColorExpression,
    glowOpacity = SHARED_POINT_UNIFORM_GLOW_OPACITY,
    primarySortProperty,
    primarySortValue,
    strokeWidthExpression = sharedPointStrokeWidthExpression(),
    strokeColorExpression = sharedPointStrokeColorExpression(),
    featureStateHover,
  } = options;

  const glowColor = glowColorExpression ?? paintColorFromProperty();
  const hoverPaint = featureStateHover
    ? buildSharedPointFeatureStateHoverPaint(featureStateHover)
    : null;

  if (map.getLayer?.(glowLayerId)) {
    map.setPaintProperty?.(glowLayerId, 'circle-color', glowColor);
    if (hoverPaint) {
      map.setPaintProperty?.(glowLayerId, 'circle-radius', hoverPaint.glowRadius);
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', hoverPaint.glowOpacity);
    } else {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', glowOpacity);
    }
  }

  if (map.getLayer?.(pointLayerId)) {
    map.setPaintProperty?.(pointLayerId, 'circle-color', pointColorExpression);
    map.setPaintProperty?.(pointLayerId, 'circle-radius', pointRadiusExpression);
    if (hoverPaint) {
      map.setPaintProperty?.(pointLayerId, 'circle-opacity', hoverPaint.pointOpacity);
      map.setPaintProperty?.(pointLayerId, 'circle-stroke-width', hoverPaint.pointStrokeWidth);
      map.setPaintProperty?.(pointLayerId, 'circle-stroke-color', hoverPaint.pointStrokeColor);
    } else {
      map.setPaintProperty?.(pointLayerId, 'circle-stroke-width', strokeWidthExpression);
      map.setPaintProperty?.(pointLayerId, 'circle-stroke-color', strokeColorExpression);
    }

    if (primarySortProperty && primarySortValue && map.setLayoutProperty) {
      try {
        map.setLayoutProperty(
          pointLayerId,
          'circle-sort-key',
          circleSortKeyByProperty(primarySortProperty, primarySortValue)
        );
      } catch {
        // Ignore if provider/style doesn't support circle-sort-key.
      }
    }
  }

  const hoverGlowLayerId = `${glowLayerId}-hover`;
  if (map.getLayer?.(hoverGlowLayerId)) {
    map.setPaintProperty?.(
      hoverGlowLayerId,
      'circle-radius',
      SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION
    );
  }
}

/**
 * Attach a styledata listener until hover glow radius is applied (layer may appear async).
 * Returns cleanup to remove the listener.
 */
export function attachSharedPointHoverGlowRadiusSync(
  map: MapInstance,
  glowLayerId: string
): () => void {
  const hoverGlowLayerId = `${glowLayerId}-hover`;
  let applied = false;

  const onStyleData = () => {
    if (applied) return;
    if (!map.getLayer?.(hoverGlowLayerId)) return;
    try {
      map.setPaintProperty?.(
        hoverGlowLayerId,
        'circle-radius',
        SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION
      );
      applied = true;
      map.off?.('styledata', onStyleData);
    } catch {
      // Layer might not be ready yet.
    }
  };

  map.on?.('styledata', onStyleData);
  onStyleData();

  return () => {
    map.off?.('styledata', onStyleData);
  };
}
