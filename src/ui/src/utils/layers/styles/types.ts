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
export function resolveGlowOpacity(element: Element | null = document.documentElement): number {
  return getCSSVariableNumber(element, '--gk-point-glow-opacity', 0);
}

/** Resolve glow blur from CSS (theme.css must be loaded) */
export function resolveGlowBlur(element: Element | null = document.documentElement): number {
  return getCSSVariableNumber(element, '--gk-glow-blur', 0);
}

/** Resolve default layer/point color from CSS (theme.css must be loaded) */
export function resolveDefaultLayerColor(element: Element | null = document.documentElement): string {
  return getCSSVariable(element, '--gk-point-color', '');
}

/** Resolve glow paint color: explicit glow → point fill → theme default */
export function resolveSharedGlowColor(
  glowColor: string | unknown[] | undefined,
  circleColor: string | unknown[] | undefined,
  element: Element | null = document.documentElement
): string | unknown[] {
  return glowColor ?? circleColor ?? resolveDefaultLayerColor(element);
}

/** Resolve default stroke color from CSS (theme.css must be loaded) */
export function resolveDefaultStrokeColor(element: Element | null = document.documentElement): string {
  return getCSSVariable(element, '--gk-point-stroke-color', '');
}

/** Resolve point circle opacity from CSS (theme.css must be loaded) */
export function resolvePointOpacity(element: Element | null = document.documentElement): number {
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
