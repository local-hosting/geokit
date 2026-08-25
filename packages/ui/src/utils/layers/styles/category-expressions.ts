/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../../../providers/types.js';
import type { Feature } from '@geokit/core/types';
import { getFeatureId } from '@geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../map-surface/theme.js';
import { debug } from '../../map-surface/logger.js';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../map-surface/feature-state-hover.js';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
} from '../../paint/shared-point-paint.js';
import { resolveSharedPointLayerIdForSource } from '../../shared-points/shared-point-heal.js';

// ============================================================================
// Types
// ============================================================================
import type { CategoryStyleConfig, FeatureStateOpacityConfig, CircleStyleOptions } from './types.js';

export function safeGet(property: string, fallback: string): unknown[];
export function safeGet(property: string, fallback: number): unknown[];
export function safeGet(property: string, fallback: string | number): unknown[] {
  return ['coalesce', ['get', property], fallback];
}

/**
 * Build a category-based color expression.
 * Creates a 'case' expression that matches property values to colors.
 * Uses coalesce so unknown/missing property values use the default (avoids MapLibre "unknown feature value").
 *
 * @param config - Category style configuration
 * @returns MapLibre expression for circle-color
 *
 * @example
 * ```ts
 * const colorExpr = buildCategoryColorExpression({
 *   property: 'brand',
 *   categories: {
 *     'premium': { color: '#gold' },
 *     'standard': { color: '#silver' },
 *   },
 *   defaults: { color: '#gray' }
 * });
 * ```
 */
export function buildCategoryColorExpression(config: CategoryStyleConfig): unknown[] {
  const { property, categories, defaults } = config;
  const expr: unknown[] = ['case'];

  for (const [category, style] of Object.entries(categories)) {
    if (style.color) {
      expr.push(['==', safeGet(property, ''), category]);
      expr.push(style.color);
    }
  }

  expr.push(defaults.color);
  return expr;
}

/**
 * Build a category-based glow opacity expression with hover/selected states.
 * Creates an expression that handles feature-state for interactions.
 *
 * @param config - Category style configuration
 * @param stateConfig - Feature state opacity overrides
 * @returns MapLibre expression for circle-opacity
 */
export function buildCategoryGlowOpacityExpression(
  config: CategoryStyleConfig,
  stateConfig: FeatureStateOpacityConfig = { selected: 1, hover: 1, default: 0.4 }
): unknown[] {
  const { property, categories, defaults } = config;

  // Build the base opacity match expression (coalesce avoids "unknown feature value")
  const baseOpacity: unknown[] = ['match', safeGet(property, '')];
  for (const [category, style] of Object.entries(categories)) {
    if (style.glowOpacity !== undefined) {
      baseOpacity.push(category, style.glowOpacity);
    }
  }
  baseOpacity.push(defaults.glowOpacity ?? 0.4);

  // Wrap with feature-state for hover/selected
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    stateConfig.selected ?? 1,
    ['boolean', ['feature-state', 'hover'], false],
    stateConfig.hover ?? 1,
    baseOpacity,
  ];
}

/**
 * Build a category-based stroke width expression.
 *
 * @param config - Category style configuration
 * @returns MapLibre expression for circle-stroke-width
 */
export function buildCategoryStrokeWidthExpression(config: CategoryStyleConfig): unknown[] {
  const { property, categories, defaults } = config;
  const expr: unknown[] = ['case'];

  for (const [category, style] of Object.entries(categories)) {
    if (style.strokeWidth !== undefined) {
      expr.push(['==', safeGet(property, ''), category]);
      expr.push(style.strokeWidth);
    }
  }

  expr.push(defaults.strokeWidth ?? 0);
  return expr;
}

/**
 * Build a category-based radius scale expression.
 * Use with pointRadius: ['*', baseRadius, scaleExpression]
 *
 * @param config - Category style configuration
 * @returns MapLibre expression for radius multiplier
 */
export function buildCategoryRadiusScaleExpression(config: CategoryStyleConfig): unknown[] {
  const { property, categories, defaults } = config;
  const expr: unknown[] = ['match', safeGet(property, '')];

  for (const [category, style] of Object.entries(categories)) {
    if (style.radiusScale !== undefined) {
      expr.push(category, style.radiusScale);
    }
  }

  expr.push(defaults.radiusScale ?? 1);
  return expr;
}

/**
 * Build an opacity expression based on whether a property exists (e.g., rating).
 * Useful for showing rated items more prominently than unrated ones.
 *
 * @param ratingProperty - Property name to check (e.g., 'averageRating')
 * @param ratedOpacity - Opacity when property exists (default: 1)
 * @param unratedOpacity - Opacity when property doesn't exist (default: 0.55)
 * @param includeHoverStates - Whether to include hover/selected states
 * @returns MapLibre expression for circle-opacity
 */
export function buildRatingOpacityExpression(
  ratingProperty: string = 'averageRating',
  ratedOpacity: number = 1,
  unratedOpacity: number = 0.55,
  includeHoverStates: boolean = true
): unknown[] {
  if (!includeHoverStates) {
    return ['case', ['has', ratingProperty], ratedOpacity, unratedOpacity];
  }

  return [
    'case',
    // Selected state - full brightness
    ['boolean', ['feature-state', 'selected'], false],
    1,
    // Hover state - more prominent
    ['boolean', ['feature-state', 'hover'], false],
    ['case', ['has', ratingProperty], ratedOpacity, 0.85],
    // Default - rated vs unrated
    ['has', ratingProperty],
    ratedOpacity,
    unratedOpacity,
  ];
}

/**
 * Build a simple feature-state opacity expression.
 * Adds hover and selected states to a base opacity.
 *
 * @param baseOpacity - Default opacity value
 * @param hoverOpacity - Opacity on hover (default: 1)
 * @param selectedOpacity - Opacity when selected (default: 1)
 * @returns MapLibre expression for circle-opacity
 */
export function buildFeatureStateOpacityExpression(
  baseOpacity: number,
  hoverOpacity: number = 1,
  selectedOpacity: number = 1
): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedOpacity,
    ['boolean', ['feature-state', 'hover'], false],
    hoverOpacity,
    baseOpacity,
  ];
}

/** Minimum circle radius in pixels (MapTiler/MapLibre can drop sub-2px points). */
export const MIN_POINT_RADIUS_PX = 3;

/** Padding beyond point edge for base glow halo (px). */
export const GLOW_HIT_PADDING_PX = 2;

/** Padding beyond point edge for hover halo (px). */
export const HOVER_GLOW_PADDING_PX = 3.5;

/** Bake a px offset into interpolate stops (MapTiler-safe; avoids ['+', interpolate, n]). */
export function offsetRadiusInterpolation(
  interpolate: unknown[],
  offset: number,
  minRadius = 0
): unknown[] {
  if (!Array.isArray(interpolate) || interpolate[0] !== 'interpolate') {
    return interpolate;
  }
  const result = [...interpolate];
  for (let i = 4; i < result.length; i += 2) {
    if (typeof result[i] === 'number') {
      result[i] = Math.max(minRadius, (result[i] as number) + offset);
    }
  }
  return result;
}

export function scaleRadiusInterpolation(
  interpolate: unknown[],
  scale: number,
  minRadiusPx: number = MIN_POINT_RADIUS_PX
): unknown[] {
  if (
    !Array.isArray(interpolate) ||
    interpolate[0] !== 'interpolate' ||
    typeof scale !== 'number' ||
    scale === 1
  ) {
    return interpolate;
  }

  const scaled = [...interpolate];
  for (let i = 4; i < scaled.length; i += 2) {
    if (typeof scaled[i] === 'number') {
      scaled[i] = Math.max(minRadiusPx, (scaled[i] as number) * scale);
    }
  }
  return scaled;
}

export function defaultScaleFromMatchExpression(scaleExpression: unknown[]): number {
  if (!Array.isArray(scaleExpression) || scaleExpression[0] !== 'match') return 1;
  const fallback = scaleExpression[scaleExpression.length - 1];
  return typeof fallback === 'number' ? fallback : 1;
}

/**
 * Multiply a base radius expression by a scale expression.
 * Useful for category-based radius scaling.
 *
 * MapTiler/MapLibre silently reject `['*', interpolate, match]` and `case` branches that
 * return interpolate expressions for circle-radius. When the scale is a match expression,
 * we apply the match fallback scale to the interpolate stops instead.
 *
 * @param baseRadius - Base radius expression (e.g., from getPointRadiusInterpolation)
 * @param scaleExpression - Scale multiplier expression (e.g., from buildCategoryRadiusScaleExpression)
 * @returns MapLibre expression for scaled radius
 */
export function multiplyRadiusExpression(
  baseRadius: unknown[],
  scaleExpression: unknown[] | number,
  options: Pick<CircleStyleOptions, 'minRadiusPx'> = {}
): unknown[] {
  const minRadiusPx = options.minRadiusPx ?? MIN_POINT_RADIUS_PX;
  if (typeof scaleExpression === 'number') {
    if (Array.isArray(baseRadius) && baseRadius[0] === 'interpolate') {
      return scaleRadiusInterpolation(baseRadius, scaleExpression, minRadiusPx);
    }
    if (
      Array.isArray(baseRadius) &&
      baseRadius[0] === '*' &&
      Array.isArray(baseRadius[1]) &&
      baseRadius[1][0] === 'interpolate' &&
      Array.isArray(baseRadius[2]) &&
      baseRadius[2][0] === 'case'
    ) {
      return expandInterpolateCaseMultiply(
        scaleRadiusInterpolation(baseRadius[1] as unknown[], 1, minRadiusPx),
        baseRadius[2] as unknown[],
        scaleExpression
      );
    }
    if (
      Array.isArray(baseRadius) &&
      baseRadius[0] === '*' &&
      Array.isArray(baseRadius[1]) &&
      baseRadius[1][0] === 'interpolate'
    ) {
      return [
        '*',
        scaleRadiusInterpolation(baseRadius[1] as unknown[], scaleExpression, minRadiusPx),
        baseRadius[2],
      ];
    }
    return ['*', baseRadius, scaleExpression];
  }

  if (Array.isArray(scaleExpression) && scaleExpression[0] === 'match') {
    return scaleRadiusInterpolation(
      baseRadius,
      defaultScaleFromMatchExpression(scaleExpression),
      minRadiusPx
    );
  }

  if (
    Array.isArray(scaleExpression) &&
    scaleExpression[0] === 'case' &&
    Array.isArray(baseRadius) &&
    baseRadius[0] === 'interpolate'
  ) {
    return expandInterpolateCaseMultiply(baseRadius, scaleExpression);
  }

  return ['*', baseRadius, scaleExpression];
}

// ============================================================================
// Zoom Interpolation Expressions
// ============================================================================

/**
 * Get zoom-based radius interpolation for point circles
 * Creates smooth scaling from min to max zoom levels
 *
 * @param options - Style options (scale, exponent)
 * @returns MapLibre interpolation expression
 *
 * @example
 * ```ts
 * const radius = getPointRadiusInterpolation({ scale: 1.5 });
 * map.addLayer({
 *   paint: { 'circle-radius': radius }
 * });
 * ```
 */
