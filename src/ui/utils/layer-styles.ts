/**
 * Generic Layer Styling Utilities
 *
 * Zoom-based interpolation expressions and layer creation patterns for MapLibre.
 * Use these utilities to create consistent, scalable point and glow layers.
 */

import type { MapInstance } from '../providers/types';

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
  /** Glow opacity */
  glowOpacity: number;
  /** Glow opacity on hover */
  glowHoverOpacity: number;
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

/** Default glow opacity */
export const DEFAULT_GLOW_OPACITY = 0.15;

/** Default glow blur */
export const DEFAULT_GLOW_BLUR = 0.4;

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
    paint['circle-stroke-color'] = strokeColor || '#ffffff';
    paint['circle-stroke-opacity'] = strokeOpacity;
  } else {
    paint['circle-stroke-width'] = 0;
  }

  const layerSpec: Record<string, unknown> = {
    id,
    type: 'circle',
    source,
    paint,
  };

  if (filter) {
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
 *   color: '#3b82f6',
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
    glowOpacity = DEFAULT_GLOW_OPACITY,
    glowBlur = DEFAULT_GLOW_BLUR,
    scale = 1,
    filter,
    beforeLayerId,
    strokeColor,
    strokeWidth = 0,
  } = config;

  const glowLayerId = `${layerPrefix}-glow`;
  const pointLayerId = `${layerPrefix}-points`;

  // Create glow layer (bottom)
  if (!map.getLayer?.(glowLayerId)) {
    const glowSpec = createCircleLayerSpec({
      id: glowLayerId,
      source: sourceId,
      color: glowColor || color,
      radius: getGlowRadiusInterpolation({ scale }),
      opacity: glowOpacity,
      blur: glowBlur,
      filter,
    });

    try {
      if (beforeLayerId) {
        map.addLayer(glowSpec as any, beforeLayerId);
      } else {
        map.addLayer(glowSpec as any);
      }
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
      opacity: 1,
      strokeColor,
      strokeWidth: strokeWidth > 0 ? getStrokeWidthInterpolation(strokeWidth) : 0,
      filter,
    });

    try {
      if (beforeLayerId) {
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
  if (!map.getLayer?.(glowLayerId)) {
    // Glow opacity: selected > hover > default
    const glowSelectedOpacity = Math.min(glowHoverOpacity * 1.3, 1); // 30% brighter than hover
    const glowOpacityExpression = [
      'case',
      ['boolean', ['feature-state', 'selected'], false],
      glowSelectedOpacity,
      ['boolean', ['feature-state', 'hover'], false],
      glowHoverOpacity,
      glowOpacity,
    ];

    const glowLayerSpec: Record<string, unknown> = {
      id: glowLayerId,
      type: 'circle',
      source: sourceId,
      layout: { visibility: 'visible' },
      paint: {
        'circle-radius': glowRadius,
        'circle-color': glowColor,
        'circle-opacity': glowOpacityExpression,
        'circle-blur': glowBlur,
      },
    };

    if (filter) {
      glowLayerSpec.filter = filter;
    }

    try {
      if (beforeLayerId) {
        map.addLayer(glowLayerSpec as any, beforeLayerId);
      } else {
        map.addLayer(glowLayerSpec as any);
      }
    } catch (error) {
      console.error(`[geokit] Failed to add glow layer ${glowLayerId}:`, error);
    }
  }

  // Create point layer (top) - the actual visible point
  if (!map.getLayer?.(pointLayerId)) {
    const pointLayerSpec: Record<string, unknown> = {
      id: pointLayerId,
      type: 'circle',
      source: sourceId,
      layout: { visibility: 'visible' },
      paint: {
        'circle-radius': pointRadius,
        'circle-color': circleColor,
        'circle-opacity': circleOpacity,
        'circle-stroke-color': circleStrokeColor,
        'circle-stroke-width': circleStrokeWidth,
      },
    };

    if (filter) {
      pointLayerSpec.filter = filter;
    }

    try {
      if (beforeLayerId) {
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
      map.removeLayer(glowLayerId);
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
