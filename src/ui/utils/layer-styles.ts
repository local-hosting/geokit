/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../providers/types';
import type { Feature } from '../../types';
import { getFeatureId } from '../../utils/geojson/get-feature-id';
import { getCSSVariable, getCSSVariableNumber } from './theme';
import { debug } from './logger';
import { HOVER_CONFIG, type HoverStateHandlers } from './feature-state-hover';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
} from './shared-point-paint';
import { resolveSharedPointLayerIdForSource } from './shared-point-heal.js';

// ============================================================================
// Types
// ============================================================================

export interface CircleStyleOptions {
  /** Base size multiplier (default: 1) */
  scale?: number;
  /** Exponential interpolation factor (default: 1.5) */
  exponent?: number;
  /** Minimum circle radius in px (default: MIN_POINT_RADIUS_PX). Use lower values for dense compact embeds. */
  minRadiusPx?: number;
}

export interface GlowPointLayerConfig {
  /** Map instance */
  map: MapInstance;
  /** GeoJSON source ID */
  sourceId: string;
  /** Prefix for layer IDs (e.g., 'site' creates 'site-glow' and 'site-points') */
  layerPrefix: string;
  /** Point color (string or data-driven expression) */
  color: string | unknown[];
  /** Glow color (defaults to point color) */
  glowColor?: string | unknown[];
  /** Glow opacity (default: 0.15) */
  glowOpacity?: number;
  /** Glow blur (default: 0.4) */
  glowBlur?: number;
  /** Size scale multiplier (default: 1) */
  scale?: number;
  /** Optional filter expression */
  filter?: unknown[];
  /** Layer to insert before (for z-ordering) */
  beforeLayerId?: string;
  /** Stroke color for points (default: none) */
  strokeColor?: string;
  /** Stroke width for points (default: 0) */
  strokeWidth?: number;
}

/**
 * GK point shared layer: one source + glow + point layers for many features.
 * Uses feature-state for hover/selected so the same layer behaves like many GK points.
 * Wire hover via createHoverStateHandlers (feature-state-hover) or createSharedPointLayersWithHover.
 */
export interface SharedPointLayersConfig {
  /** Map instance */
  map: MapInstance;
  /** GeoJSON source ID */
  sourceId: string;
  /** Explicit glow layer ID */
  glowLayerId: string;
  /** Explicit point layer ID */
  pointLayerId: string;
  /** Circle fill color (string or data-driven expression) */
  circleColor: string | unknown[];
  /** Circle opacity (number or data-driven expression) */
  circleOpacity: number | unknown[];
  /** Circle stroke color (string or data-driven expression) */
  circleStrokeColor: string | unknown[];
  /** Circle stroke width (number or data-driven expression) */
  circleStrokeWidth: number | unknown[];
  /** Glow color (defaults to circleColor, then --gk-point-color) */
  glowColor?: string | unknown[];
  /** Glow opacity (number or data-driven expression) */
  glowOpacity: number | unknown[];
  /** Glow opacity on hover (number or data-driven expression) */
  glowHoverOpacity: number | unknown[];
  /** Glow blur */
  glowBlur: number;
  /** Point radius expression */
  pointRadius: unknown;
  /** Glow radius expression */
  glowRadius: unknown[];
  /** Optional filter expression */
  filter?: unknown[];
  /** Layer to insert before (for z-ordering) */
  beforeLayerId?: string;
  /**
   * When true and geojson is provided and MapTiler SDK helpers.addPoint is available,
   * the point layer is created via MapTiler's recommended helpers.addPoint (zoom-scaled radius).
   * The helper creates the source; we then add the glow layer using that source.
   */
  useMapTilerPointHelper?: boolean;
  /** GeoJSON FeatureCollection for the point (and glow) layer. Required when useMapTilerPointHelper is true. */
  geojson?: { type: 'FeatureCollection'; features: unknown[] };
  /** promoteId for the GeoJSON source when we add the source (e.g. on helper failure). Required for feature-state by id. */
  promoteId?: string;
  /** When false, glow opacity does not use feature-state hover (use with hover-via-layer in createSharedPointLayersWithHover to avoid setFeatureState). */
  useFeatureStateHover?: boolean;
  /** Selection ring stroke color (default #ffffff). Use dark color for light-themed maps. */
  selectionRingColor?: string;
  /** Soft drop shadow under the selected point (same selection source as the ring). */
  selectionShadowColor?: string;
  /** Point outline width used to size the selection ring/shadow (px). */
  selectionPointStrokeWidth?: number;
}

export interface CircleLayerConfig {
  /** Layer ID */
  id: string;
  /** Source ID */
  source: string;
  /** Circle color */
  color: string | unknown[];
  /** Circle radius expression (or use default) */
  radius?: unknown[];
  /** Circle opacity (default: 1) */
  opacity?: number;
  /** Stroke color */
  strokeColor?: string;
  /** Stroke width (number or expression) */
  strokeWidth?: number | unknown[];
  /** Stroke opacity (default: 1) */
  strokeOpacity?: number;
  /** Circle blur (default: 0) */
  blur?: number;
  /** Filter expression */
  filter?: unknown[];
}

// ============================================================================
// Constants
// ============================================================================

/** Resolve glow opacity from CSS (theme.css must be loaded) */
function resolveGlowOpacity(element: Element | null = document.documentElement): number {
  return getCSSVariableNumber(element, '--gk-point-glow-opacity', 0);
}

/** Resolve glow blur from CSS (theme.css must be loaded) */
function resolveGlowBlur(element: Element | null = document.documentElement): number {
  return getCSSVariableNumber(element, '--gk-glow-blur', 0);
}

/** Resolve default layer/point color from CSS (theme.css must be loaded) */
function resolveDefaultLayerColor(element: Element | null = document.documentElement): string {
  return getCSSVariable(element, '--gk-point-color', '');
}

/** Resolve glow paint color: explicit glow → point fill → theme default */
function resolveSharedGlowColor(
  glowColor: string | unknown[] | undefined,
  circleColor: string | unknown[] | undefined,
  element: Element | null = document.documentElement
): string | unknown[] {
  return glowColor ?? circleColor ?? resolveDefaultLayerColor(element);
}

/** Resolve default stroke color from CSS (theme.css must be loaded) */
function resolveDefaultStrokeColor(element: Element | null = document.documentElement): string {
  return getCSSVariable(element, '--gk-point-stroke-color', '');
}

/** Resolve point circle opacity from CSS (theme.css must be loaded) */
function resolvePointOpacity(element: Element | null = document.documentElement): number {
  return getCSSVariableNumber(element, '--gk-point-opacity', 0);
}

// ============================================================================
// Expression Builder Types
// ============================================================================

/**
 * Configuration for category-based styling (e.g., brand, type, status)
 */
export interface CategoryStyleConfig {
  /** Property name to match on (e.g., 'brand', 'type') */
  property: string;
  /** Map of category values to their styles */
  categories: Record<
    string,
    {
      color?: string;
      glowOpacity?: number;
      strokeWidth?: number;
      radiusScale?: number;
    }
  >;
  /** Default styles for unmatched categories */
  defaults: {
    color: string;
    glowOpacity?: number;
    strokeWidth?: number;
    radiusScale?: number;
  };
}

/**
 * Configuration for feature-state based opacity
 */
export interface FeatureStateOpacityConfig {
  /** Opacity when selected */
  selected?: number;
  /** Opacity when hovered */
  hover?: number;
  /** Default opacity (or expression) */
  default: number | unknown[];
}

// ============================================================================
// Expression Builders
// ============================================================================

/**
 * Safe property get for MapLibre expressions.
 * Wraps get in coalesce so null/undefined/unknown feature values don't throw "unknown feature value".
 */
function safeGet(property: string, fallback: string): unknown[];
function safeGet(property: string, fallback: number): unknown[];
function safeGet(property: string, fallback: string | number): unknown[] {
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
const MIN_POINT_RADIUS_PX = 3;

/** Padding beyond point edge for base glow halo (px). */
const GLOW_HIT_PADDING_PX = 2;

/** Padding beyond point edge for hover halo (px). */
const HOVER_GLOW_PADDING_PX = 3.5;

/** Bake a px offset into interpolate stops (MapTiler-safe; avoids ['+', interpolate, n]). */
function offsetRadiusInterpolation(
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

function scaleRadiusInterpolation(
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

function defaultScaleFromMatchExpression(scaleExpression: unknown[]): number {
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
const SELECTION_RING_GAP_PX = 0.5;

/**
 * Get zoom-based radius for selection ring: point radius + outline stroke + gap + half ring stroke.
 * MapLibre draws circle-stroke outside circle-radius; the ring must clear the outline edge.
 *
 * @param options - Style options (scale, exponent)
 * @param pointStrokeWidth - Point outline width (px or expression); default 0
 * @returns MapLibre expression
 */
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
function omitNil<T extends Record<string, unknown>>(o: T): Record<string, unknown> {
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

interface HoverLayerOptions {
  glowRadius: unknown[];
  glowColor: string | unknown[];
  glowBlur: number;
  glowHoverOpacity?: number | unknown[];
  circleColor: string | unknown[];
  pointRadius: unknown;
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** GeoJSON source with setData (MapLibre/MapTiler) */
interface GeoJSONSourceWithSetData {
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

function ensureSelectionRingOnTop(map: MapInstance, pointLayerId: string): void {
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

function resolveSharedPointSelectionLngLat(
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

function extractPointLngLat(geometry: unknown): { lng: number; lat: number } | null {
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
