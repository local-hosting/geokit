/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../providers/types';
import { getCSSVariable, getCSSVariableNumber } from './theme';
import { debug } from './logger';

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
 * Build a category-based color expression.
 * Creates a 'case' expression that matches property values to colors.
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
      expr.push(['==', ['get', property], category]);
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

  // Build the base opacity match expression
  const baseOpacity: unknown[] = ['match', ['get', property]];
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
      expr.push(['==', ['get', property], category]);
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
  const expr: unknown[] = ['match', ['get', property]];

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
  // Point radius smaller than glow at low zoom but still visible; glow stays large (getGlowRadiusInterpolation)
  return [
    'interpolate',
    ['exponential', exponent],
    ['zoom'],
    0,
    0.85 * scale, // Full zoom out - visible dot, glow larger
    2,
    1 * scale, // Hero minZoom 2
    3,
    1.25 * scale, // Min zoom
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
    2.5 * scale, // Full zoom out - visible glow
    2,
    3 * scale, // Hero minZoom 2 - visible when zoomed out
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
 * @param config - Layer configuration with explicit IDs and paint expressions
 */
export function createSharedPointLayers(config: SharedPointLayersConfig): void {
  const {
    map,
    sourceId,
    glowLayerId,
    pointLayerId,
    circleColor,
    circleOpacity,
    circleStrokeColor,
    circleStrokeWidth,
    glowColor,
    glowOpacity,
    glowHoverOpacity,
    glowBlur,
    pointRadius,
    glowRadius,
    filter,
    beforeLayerId,
  } = config;

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

    let glowOpacityExpression: unknown[];
    if (Array.isArray(glowOpacity)) {
      glowOpacityExpression = glowOpacity;
    } else {
      const numOpacity = typeof glowOpacity === 'number' ? glowOpacity : resolveGlowOpacity();
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

  // Create point layer (top) - the actual visible point (defaults so SDK never sees null/undefined)
  if (!map.getLayer?.(pointLayerId)) {
    const pointRadiusVal = pointRadius ?? getPointRadiusInterpolation();
    const circleColorVal = circleColor ?? resolveDefaultLayerColor();
    const circleOpacityVal = circleOpacity ?? 1;
    const circleStrokeColorVal = circleStrokeColor ?? resolveDefaultStrokeColor();
    const circleStrokeWidthVal = circleStrokeWidth ?? 0;

    const pointPaint: Record<string, unknown> = {
      'circle-radius': pointRadiusVal,
      'circle-color': circleColorVal,
      'circle-opacity': circleOpacityVal,
      'circle-stroke-color': circleStrokeColorVal,
      'circle-stroke-width': circleStrokeWidthVal,
    };
    const pointLayerSpec: Record<string, unknown> = {
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      layout: { visibility: 'visible' },
      paint: omitNil(pointPaint),
    };

    if (filter != null) {
      pointLayerSpec.filter = filter;
    }

    try {
      if (beforeLayerId != null) {
        map.addLayer(pointLayerSpec as any, beforeLayerId);
      } else {
        map.addLayer(pointLayerSpec as any);
      }
    } catch (error) {
      console.error(`[geokit] Failed to add point layer ${pointLayerId}:`, error);
    }
  }
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
