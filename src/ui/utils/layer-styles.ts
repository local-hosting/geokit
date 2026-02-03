/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../providers/types';
import { getCSSVariable, getCSSVariableNumber } from './theme';
import { debug } from './logger';
import { HOVER_CONFIG, type HoverStateHandlers } from './feature-state-hover';

// ============================================================================
// Types
// ============================================================================

export interface CircleStyleOptions {
  /** Base size multiplier (default: 1) */
  scale?: number;
  /** Exponential interpolation factor (default: 1.5) */
  exponent?: number;
}

export interface GlowPointLayerConfig {
  /** Map instance */
  map: MapInstance;
  /** GeoJSON source ID */
  sourceId: string;
  /** Prefix for layer IDs (e.g., 'venue' creates 'venue-glow' and 'venue-points') */
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
  /** Glow color (string or data-driven expression) */
  glowColor: string | unknown[];
  /** Glow opacity (number or data-driven expression) */
  glowOpacity: number | unknown[];
  /** Glow opacity on hover (number or data-driven expression) */
  glowHoverOpacity: number | unknown[];
  /** Glow blur */
  glowBlur: number;
  /** Point radius expression */
  pointRadius: unknown[];
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

/**
 * Multiply a base radius expression by a scale expression.
 * Useful for category-based radius scaling.
 *
 * @param baseRadius - Base radius expression (e.g., from getPointRadiusInterpolation)
 * @param scaleExpression - Scale multiplier expression (e.g., from buildCategoryRadiusScaleExpression)
 * @returns MapLibre expression for scaled radius
 */
export function multiplyRadiusExpression(
  baseRadius: unknown[],
  scaleExpression: unknown[]
): unknown[] {
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
  const { scale = 1, exponent = 1.5 } = options;
  // Point radius smaller than glow at low zoom; app uses minZoom 2 so radius 1 at zoom 2 is visible
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    0,
    0.85 * scale, // Full zoom out (below app minZoom 2)
    2,
    1 * scale, // App minZoom 2
    3,
    1.25 * scale,
    6,
    2 * scale, // Country view
    8,
    2.6 * scale, // Regional view (medium zoom)
    10,
    3.1 * scale, // City view
    14,
    4.25 * scale, // Neighborhood
    18,
    6.5 * scale, // Max zoom
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
  const { scale = 1, exponent = 1.5 } = options;
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    0,
    2.5 * scale, // Full zoom out (below app minZoom 2)
    2,
    3 * scale, // App minZoom 2 - visible when zoomed out
    3,
    4 * scale, // Min zoom
    6,
    5 * scale, // Country view
    8,
    6 * scale, // Regional view (medium zoom)
    10,
    8 * scale, // City view
    14,
    11 * scale, // Neighborhood
    18,
    16 * scale, // Max zoom
  ];
}

/**
 * Get zoom-based radius for selection ring: same curve as point radius + stroke + gap.
 * Ring sits around (not on top of) the point. Single interpolate expression for broad MapLibre support.
 *
 * @param options - Style options (scale, exponent)
 * @returns MapLibre interpolation expression
 */
export function getSelectionRingRadiusInterpolation(options: CircleStyleOptions = {}): unknown[] {
  const { scale = 1, exponent = 1.5 } = options;
  const gap = 2.5; // stroke width + small gap so ring doesn't cover point
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    0,
    0.85 * scale + gap,
    2,
    1 * scale + gap,
    3,
    1.25 * scale + gap,
    6,
    2 * scale + gap,
    8,
    2.6 * scale + gap,
    10,
    3.1 * scale + gap,
    14,
    4.25 * scale + gap,
    18,
    6.5 * scale + gap,
  ];
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
 *   sourceId: 'venues',
 *   layerPrefix: 'venue',
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
      console.error(`[geokit] Failed to add glow layer ${glowLayerId}:`, error);
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
      console.error(`[geokit] Failed to add point layer ${pointLayerId}:`, error);
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
/** Zoom–radius stops for MapTiler helpers.addPoint: points get larger as you zoom in. */
const MAPTILER_POINT_RADIUS_ZOOM: Array<{ zoom: number; value: number }> = [
  { zoom: 0, value: 0.85 },
  { zoom: 2, value: 1 },
  { zoom: 6, value: 2 },
  { zoom: 10, value: 3.1 },
  { zoom: 14, value: 4.25 },
  { zoom: 18, value: 6.5 },
];

/**
 * Create GK point shared layers: one source, glow layer, and point layer for many features.
 * Layers use feature-state (hover/selected) so apps can wire hover via createHoverStateHandlers
 * or createSharedPointLayersWithHover. This is the GK point pattern for many points (e.g. venues).
 */
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
  } = config;

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
      // Apply data-driven color so points show actual venue/DMA color instead of single fallback
      if (Array.isArray(circleColor) && map.setPaintProperty) {
        try {
          map.setPaintProperty(pointLayerId, 'circle-color', circleColor as any);
        } catch (paintErr) {
          console.warn(
            `[geokit] setPaintProperty circle-color failed for ${pointLayerId}:`,
            paintErr
          );
        }
      }
    } catch (error) {
      console.error(`[geokit] MapTiler helpers.addPoint failed for ${pointLayerId}:`, error);
    }
  }

  // When helper was tried and failed, ensure source exists so the manual path can add layers.
  if (useHelper && !helperSucceeded && geojson && !map.getSource?.(sourceId)) {
    try {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        ...(promoteId ? { promoteId } : {}),
      });
      debug.log('[layer-styles] source ADD (manual path)', { sourceId });
    } catch (sourceErr) {
      console.error(`[geokit] Failed to add source ${sourceId}:`, sourceErr);
    }
  }

  if (helperSucceeded) {
    // Add glow layer below the point layer (same source created by the helper)
    if (!map.getLayer?.(glowLayerId)) {
      const glowRadiusVal = glowRadius ?? getGlowRadiusInterpolation({ scale: 1 });
      const glowColorVal = glowColor ?? resolveDefaultLayerColor();
      const glowBlurVal = glowBlur ?? resolveGlowBlur();
      let glowOpacityExpression: unknown[] | number;
      if (Array.isArray(glowOpacity)) {
        glowOpacityExpression = glowOpacity;
      } else {
        const numOpacity = typeof glowOpacity === 'number' ? glowOpacity : resolveGlowOpacity();
        if (!useFeatureStateHover) {
          glowOpacityExpression = numOpacity;
        } else {
          const hoverOpacity = typeof glowHoverOpacity === 'number' ? glowHoverOpacity : 1;
          const selectedOpacity = Math.min(hoverOpacity * 1.3, 1);
          glowOpacityExpression = [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            selectedOpacity,
            ['boolean', ['feature-state', 'hover'], false],
            hoverOpacity,
            numOpacity,
          ];
        }
      }
      const glowPaint: Record<string, unknown> = {
        'circle-radius': glowRadiusVal,
        'circle-color': glowColorVal,
        'circle-opacity': glowOpacityExpression,
        'circle-blur': glowBlurVal,
      };
      const glowLayerSpec: Record<string, unknown> = {
        id: glowLayerId,
        type: 'circle',
        source: sourceId,
        layout: { visibility: 'visible' },
        paint: omitNil(glowPaint),
      };
      if (filter != null) glowLayerSpec.filter = filter;
      try {
        map.addLayer(glowLayerSpec as any, pointLayerId);
        debug.log('[layer-styles] glow layer ADD done (below MapTiler point)', { glowLayerId });
      } catch (err) {
        console.error(`[geokit] Failed to add glow layer ${glowLayerId}:`, err);
      }
    }
    // Selection ring: zoom-based radius just outside point so ring is visible and doesn't cover the point
    const ringLayerId = `${pointLayerId}-selection-ring`;
    if (!map.getLayer?.(ringLayerId)) {
      try {
        map.addLayer({
          id: ringLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['coalesce', ['get', '__selected'], false], true],
          paint: {
            'circle-radius': getSelectionRingRadiusInterpolation(),
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        } as any);
      } catch (err) {
        console.error(`[geokit] Failed to add selection ring ${ringLayerId}:`, err);
      }
    }

    // Setup automatic hover layers (same pattern as non-helper path)
    setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
      glowRadius: glowRadius ?? getGlowRadiusInterpolation({ scale: 1 }),
      glowColor: glowColor ?? resolveDefaultLayerColor(),
      glowBlur: glowBlur ?? resolveGlowBlur(),
      glowHoverOpacity,
      circleColor,
      pointRadius: pointRadius ?? getPointRadiusInterpolation(),
    });
    return;
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
    const glowRadiusVal = glowRadius ?? getGlowRadiusInterpolation({ scale: 1 });
    const glowColorVal = glowColor ?? resolveDefaultLayerColor();
    const glowBlurVal = glowBlur ?? resolveGlowBlur();

    let glowOpacityExpression: unknown[] | number;
    if (Array.isArray(glowOpacity)) {
      glowOpacityExpression = glowOpacity;
    } else {
      const numOpacity = typeof glowOpacity === 'number' ? glowOpacity : resolveGlowOpacity();
      if (!useFeatureStateHover) {
        glowOpacityExpression = numOpacity;
      } else {
        const hoverOpacity = typeof glowHoverOpacity === 'number' ? glowHoverOpacity : 1;
        const selectedOpacity = Math.min(hoverOpacity * 1.3, 1);
        glowOpacityExpression = [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          selectedOpacity,
          ['boolean', ['feature-state', 'hover'], false],
          hoverOpacity,
          numOpacity,
        ];
      }
    }

    const glowPaint: Record<string, unknown> = {
      'circle-radius': glowRadiusVal,
      'circle-color': glowColorVal,
      'circle-opacity': glowOpacityExpression,
      'circle-blur': glowBlurVal,
    };
    const glowLayerSpec: Record<string, unknown> = {
      id: glowLayerId,
      type: 'circle',
      source: sourceId,
      layout: { visibility: 'visible' },
      paint: omitNil(glowPaint),
    };

    if (filter != null) {
      glowLayerSpec.filter = filter;
    }

    try {
      if (beforeLayerId != null) {
        map.addLayer(glowLayerSpec as any, beforeLayerId);
      } else {
        map.addLayer(glowLayerSpec as any);
      }
      debug.log('[layer-styles] glow layer ADD done', { glowLayerId });
    } catch (error) {
      console.error(`[geokit] Failed to add glow layer ${glowLayerId}:`, error);
    }
  }

  // Point layer (top): zoom-based radius so points get larger as you zoom in; data-driven circle-color.
  // Dot stays original (venue) color. White ring is selection-ring layer (filter __selected).
  if (!map.getLayer?.(pointLayerId)) {
    const circleColorVal = circleColor ?? resolveDefaultLayerColor();
    const radiusVal = pointRadius ?? getPointRadiusInterpolation();
    const pointPaint: Record<string, unknown> = {
      'circle-radius': radiusVal,
      'circle-color': circleColorVal,
      'circle-opacity': 1,
      'circle-blur': 0,
    };
    const pointLayerSpec: Record<string, unknown> = {
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      layout: { visibility: 'visible' },
      paint: omitNil(pointPaint),
    };
    if (filter != null) pointLayerSpec.filter = filter;

    try {
      map.addLayer(pointLayerSpec as any);
    } catch (error) {
      console.error(`[geokit] Failed to add point layer ${pointLayerId}:`, error, { sourceId });
      // Fallback: static white dots so points remain visible (data-driven color may have failed)
      try {
        const fallbackSpec = {
          id: pointLayerId,
          type: 'circle',
          source: sourceId,
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
        console.error(`[geokit] Fallback point layer also failed ${pointLayerId}:`, fallbackError);
      }
    }

    // Selection ring: zoom-based radius just outside point so ring is visible and doesn't cover the point
    const ringLayerId = `${pointLayerId}-selection-ring`;
    if (!map.getLayer?.(ringLayerId)) {
      try {
        map.addLayer({
          id: ringLayerId,
          type: 'circle',
          source: sourceId,
          filter: ['==', ['coalesce', ['get', '__selected'], false], true],
          paint: {
            'circle-radius': getSelectionRingRadiusInterpolation(),
            'circle-color': 'rgba(0,0,0,0)',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        } as any);
      } catch (err) {
        console.error(`[geokit] Failed to add selection ring ${ringLayerId}:`, err);
      }
    }
  }

  // Setup automatic hover layers using dedicated source (avoids feature-state issues)
  setupHoverLayers(map, sourceId, glowLayerId, pointLayerId, {
    glowRadius: glowRadius ?? getGlowRadiusInterpolation({ scale: 1 }),
    glowColor: glowColor ?? resolveDefaultLayerColor(),
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
  pointRadius: unknown[];
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

/** GeoJSON source with setData (MapLibre/MapTiler) */
interface GeoJSONSourceWithSetData {
  setData?(data: GeoJSON.FeatureCollection | GeoJSON.Feature): void;
}

/**
 * Setup hover layers for shared point layers.
 * Creates a dedicated hover source + glow layer + point layer that respond to mouse events.
 * Uses HOVER_CONFIG from feature-state-hover.ts as source of truth.
 */
function setupHoverLayers(
  map: MapInstance,
  sourceId: string,
  glowLayerId: string,
  pointLayerId: string,
  options: HoverLayerOptions
): void {
  const { glowHoverOpacity, circleColor } = options;
  const hoverSourceId = `${sourceId}-hover`;
  const hoverGlowLayerId = `${glowLayerId}-hover`;

  // Create hover source
  if (!map.getSource?.(hoverSourceId)) {
    try {
      map.addSource(hoverSourceId, {
        type: 'geojson',
        data: EMPTY_GEOJSON,
      });
      debug.log('[layer-styles] hover source ADD', { hoverSourceId });
    } catch (err) {
      console.error(`[geokit] Failed to add hover source ${hoverSourceId}:`, err);
      return;
    }
  }

  // Create hover glow layer BELOW the point layer so original point stays on top
  // Use the same color expression as the point (DMA color) for the glow
  const hoverGlowRadiusVal = getGlowRadiusInterpolation({ scale: HOVER_CONFIG.glowRadiusScale });
  const hoverOpacity =
    typeof glowHoverOpacity === 'number' ? glowHoverOpacity : HOVER_CONFIG.glowOpacity;

  // Add BELOW the base glow layer so hover glow is at the very bottom
  const addBeforeLayer = map.getLayer?.(glowLayerId) ? glowLayerId : undefined;

  if (map.getSource?.(hoverSourceId) && !map.getLayer?.(hoverGlowLayerId)) {
    try {
      map.addLayer(
        {
          id: hoverGlowLayerId,
          type: 'circle',
          source: hoverSourceId,
          paint: {
            'circle-radius': hoverGlowRadiusVal,
            'circle-color': circleColor, // Use DMA color expression
            'circle-opacity': hoverOpacity,
            'circle-blur': HOVER_CONFIG.glowBlur,
          },
        } as any,
        addBeforeLayer // Add BELOW the point/glow layer
      );
    } catch (err) {
      console.error(`[geokit] Failed to add hover glow layer ${hoverGlowLayerId}:`, err);
    }
  }

  // Attach mouse handlers to glow and point layers
  const hitLayers = [glowLayerId, pointLayerId].filter((id) => map.getLayer?.(id));
  debug.log('[layer-styles] setupHoverLayers', {
    hitLayers,
    hoverSourceId,
    hoverGlowLayerId,
    hasHoverSource: !!map.getSource?.(hoverSourceId),
    hasHoverGlowLayer: !!map.getLayer?.(hoverGlowLayerId),
  });
  if (hitLayers.length === 0) {
    debug.log('[layer-styles] setupHoverLayers: no hit layers found, skipping');
    return;
  }

  // Store the current hover feature for re-rendering
  let currentHoverFeature: GeoJSON.Feature | null = null;

  function renderHoverFeature(): void {
    if (!currentHoverFeature || !map) return;

    const source = map.getSource?.(hoverSourceId) as GeoJSONSourceWithSetData | undefined;
    if (!source?.setData) return;

    try {
      source.setData({ type: 'FeatureCollection', features: [currentHoverFeature] });
    } catch {
      return;
    }

    // Create glow layer BELOW the point layer so original point stays on top
    const hoverGlowRadiusVal = getGlowRadiusInterpolation({ scale: HOVER_CONFIG.glowRadiusScale });

    // Add BELOW the base glow layer so hover glow is at the very bottom
    const beforeLayer = map.getLayer?.(glowLayerId) ? glowLayerId : undefined;

    if (!map.getLayer?.(hoverGlowLayerId)) {
      try {
        map.addLayer(
          {
            id: hoverGlowLayerId,
            type: 'circle',
            source: hoverSourceId,
            paint: {
              'circle-radius': hoverGlowRadiusVal,
              'circle-color': circleColor, // Use DMA color expression
              'circle-opacity': HOVER_CONFIG.glowOpacity,
              'circle-blur': HOVER_CONFIG.glowBlur,
            },
          } as any,
          beforeLayer // Add BELOW the point/glow layer
        );
      } catch {
        // ignore
      }
    }
  }

  function clearHoverFeature(): void {
    currentHoverFeature = null;
    const source = map?.getSource?.(hoverSourceId) as GeoJSONSourceWithSetData | undefined;
    if (source?.setData) {
      try {
        source.setData(EMPTY_GEOJSON);
      } catch {
        // ignore
      }
    }
  }

  // Re-render on each frame while hovering (ensures layers stay visible)
  let hoverAnimationId: number | null = null;

  function startHoverAnimation(): void {
    if (hoverAnimationId !== null) return;

    function animate(): void {
      if (currentHoverFeature) {
        renderHoverFeature();
        hoverAnimationId = requestAnimationFrame(animate);
      } else {
        hoverAnimationId = null;
      }
    }
    hoverAnimationId = requestAnimationFrame(animate);
  }

  function stopHoverAnimation(): void {
    if (hoverAnimationId !== null) {
      cancelAnimationFrame(hoverAnimationId);
      hoverAnimationId = null;
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

  function onMouseEnter(e: {
    features?: Array<{ geometry?: unknown; properties?: Record<string, unknown> }>;
  }): void {
    const features = e?.features;
    if (!features?.length) {
      clearHoverFeature();
      stopHoverAnimation();
      setCursor('');
      return;
    }
    setCursor('pointer');
    const f = features[0];
    const geometry = f?.geometry;
    if (!geometry) {
      clearHoverFeature();
      stopHoverAnimation();
      return;
    }

    // Store the hover feature and start animation loop to keep layers alive
    currentHoverFeature = {
      type: 'Feature',
      geometry: geometry as GeoJSON.Geometry,
      properties: { ...(f.properties || {}) },
    };
    startHoverAnimation();
  }

  function onMouseLeave(): void {
    stopHoverAnimation();
    clearHoverFeature();
    setCursor('');
  }

  // Attach handlers to all hit layers
  for (const layerId of hitLayers) {
    try {
      map.on('mouseenter', layerId, onMouseEnter as any);
      map.on('mouseleave', layerId, onMouseLeave as any);
      debug.log('[layer-styles] attached hover handlers to layer', layerId);
    } catch (err) {
      debug.log('[layer-styles] FAILED to attach hover handlers', layerId, err);
    }
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
      console.error(`[geokit] Failed to add hover source ${hoverSourceId}:`, err);
    }
  }

  // Add hover glow layer with larger radius for visual feedback
  // Uses HOVER_CONFIG from feature-state-hover.ts as source of truth
  if (map.getSource?.(hoverSourceId) && !map.getLayer?.(hoverLayerId)) {
    // If custom glowRadius provided, scale it; otherwise use default with hover scale
    const glowRadiusVal = glowRadius
      ? ['*', glowRadius, HOVER_CONFIG.glowRadiusScale]
      : getGlowRadiusInterpolation({ scale: HOVER_CONFIG.glowRadiusScale });
    const glowColorVal = glowColor ?? resolveDefaultLayerColor();
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
      console.error(`[geokit] Failed to add hover layer ${hoverLayerId}:`, err);
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
          'circle-stroke-width': HOVER_CONFIG.pointStrokeWidth,
          'circle-stroke-color': HOVER_CONFIG.pointStrokeColor,
        },
      } as any);
      debug.log('[layer-styles] hover point layer ADD', { hoverPointLayerId });
    } catch (err) {
      console.error(`[geokit] Failed to add hover point layer ${hoverPointLayerId}:`, err);
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
    console.error(`[geokit] Failed to remove layers for ${layerPrefix}:`, error);
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
    console.error(`[geokit] Failed to set visibility for ${layerPrefix}:`, error);
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
    console.error(`[geokit] Failed to set filter for ${layerPrefix}:`, error);
  }
}
