/**
 * Feature-state hover utilities
 *
 * Single place for hover highlight logic: set/clear feature-state and
 * build data-driven opacity expressions. Used by PointElement and by
 * apps (e.g. venue layers) that render many points from one source.
 *
 * This is the SOURCE OF TRUTH for all hover visual behavior in GeoKit.
 */

// ============================================================================
// Hover Visual Configuration (SOURCE OF TRUTH)
// ============================================================================

/**
 * Hover visual configuration - centralized settings for consistent hover behavior.
 * Used by both individual gk-point elements and shared point layers.
 */
export const HOVER_CONFIG = {
  /** Scale factor for hover glow radius vs base glow */
  glowRadiusScale: 1.35,

  /** Default glow opacity on dedicated hover layer */
  glowOpacity: 0.35,

  /** Blur for hover glow (MapLibre 0–1; keep below 1 to avoid muddy halos) */
  glowBlur: 0.55,

  /** Point stroke width on hover for brightness effect */
  pointStrokeWidth: 3,

  /** Point stroke color on hover (bright white for maximum visibility) */
  pointStrokeColor: '#FFFFFF',

  /** Point opacity on hover */
  pointOpacity: 1,
} as const;

// ============================================================================
// Types
// ============================================================================

// Minimal map interface for feature-state and cursor (avoids pulling full MapInstance).
// getCanvas may return a canvas-like object (some providers return a wrapper).
export interface MapWithFeatureState {
  setFeatureState?(state: { source: string; id: string | number }, props: { hover: boolean }): void;
  removeFeatureState?(state: { source: string; id: string | number }): void;
  getSource?(id: string): unknown;
  getCanvas?():
    | {
        style?: {
          cursor?: string;
          setProperty?(property: string, value: string, priority?: string): void;
        };
      }
    | undefined;
}

export interface CreateHoverStateHandlersOptions {
  map: MapWithFeatureState | null | undefined;
  /** Resolve source ID for the hovered feature (e.g. from event or fixed for single-point) */
  getSourceId: (e?: { features?: Array<{ properties?: Record<string, unknown> }> }) => string;
  /** Resolve feature ID for feature-state (must match source promoteId) */
  getFeatureId: (e: {
    features?: Array<{ properties?: Record<string, unknown> }>;
  }) => string | number | null;
}

export interface HoverStateHandlers {
  onMouseEnter: (e: { features?: Array<{ properties?: Record<string, unknown> }> }) => void;
  onMouseLeave: () => void;
}

// ============================================================================
// Legacy Constants (kept for backward compatibility)
// ============================================================================

/** Default opacity when hovered (highlight glow) */
export const HOVER_GLOW_OPACITY = HOVER_CONFIG.glowOpacity;

/** Default opacity for point circle when hovered */
export const HOVER_POINT_OPACITY = HOVER_CONFIG.pointOpacity;

/** Default opacity when focused (more prominent than hover) */
export const FOCUS_GLOW_OPACITY = 0.9;

/** Default opacity for point circle when focused */
export const FOCUS_POINT_OPACITY = 1;

// ============================================================================
// Hover Radius Utilities
// ============================================================================

/**
 * Scale a radius expression by the hover glow scale factor.
 * Use this to create hover glow radius from base glow radius.
 *
 * @param baseRadius - Base radius expression (MapLibre interpolation or number)
 * @returns Scaled radius expression for hover state
 */
export function scaleRadiusForHover(baseRadius: unknown[] | number): unknown[] | number {
  if (typeof baseRadius === 'number') {
    return baseRadius * HOVER_CONFIG.glowRadiusScale;
  }
  return ['*', baseRadius, HOVER_CONFIG.glowRadiusScale];
}

/**
 * Get hover point paint properties for brightness effect.
 * Apply these to a hover point layer.
 */
export function getHoverPointPaint(baseColor: string | unknown[]): Record<string, unknown> {
  return {
    'circle-color': baseColor,
    'circle-opacity': HOVER_CONFIG.pointOpacity,
    'circle-blur': 0,
    'circle-stroke-width': HOVER_CONFIG.pointStrokeWidth,
    'circle-stroke-color': HOVER_CONFIG.pointStrokeColor,
  };
}

/**
 * Build MapLibre circle-opacity expression: hover => hoverOpacity, else defaultOpacity.
 * Use with a source that has promoteId and layers that receive feature-state from setFeatureState.
 * defaultOpacity can be a number or a data-driven expression (e.g. rating-based opacity).
 */
export function buildOpacityWithHoverExpression(
  defaultOpacity: number | unknown[] | string,
  hoverOpacity: number | string
): unknown[] {
  return ['case', ['boolean', ['feature-state', 'hover'], false], hoverOpacity, defaultOpacity];
}

/**
 * Build MapLibre circle-opacity expression that handles both focus and hover states.
 * Priority: focus > hover > default
 * Use with a source that has promoteId and layers that receive feature-state.
 */
export function buildOpacityWithFocusAndHoverExpression(
  defaultOpacity: number | unknown[],
  hoverOpacity: number,
  focusOpacity: number
): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'focus'], false],
    focusOpacity,
    ['boolean', ['feature-state', 'hover'], false],
    hoverOpacity,
    defaultOpacity,
  ];
}

/**
 * Create mouseenter/mouseleave handlers that set/clear feature-state hover and cursor.
 * Call this once and attach to your layer(s). App-specific logic (e.g. prefetch) can wrap or run after onMouseEnter.
 */
export function createHoverStateHandlers(
  options: CreateHoverStateHandlersOptions
): HoverStateHandlers {
  const { map, getSourceId, getFeatureId } = options;
  let lastHovered: { sourceId: string; id: string | number } | null = null;

  function setCursor(cursor: string): void {
    const canvas = map?.getCanvas?.();
    if (canvas?.style?.setProperty) {
      canvas.style.setProperty('cursor', cursor, 'important');
    } else if (canvas?.style) {
      canvas.style.cursor = cursor;
    }
  }

  function clearFeatureState(): void {
    if (!lastHovered) return;
    // Only call removeFeatureState if the source still exists (avoids MapLibre coalesceChanges
    // "Cannot convert undefined or null to object" after style replace, e.g. theme toggle).
    if (map?.removeFeatureState && map?.getSource?.(lastHovered.sourceId)) {
      try {
        map.removeFeatureState({ source: lastHovered.sourceId, id: lastHovered.id });
      } catch {
        // ignore
      }
    }
    lastHovered = null;
  }

  function clearHoverState(): void {
    clearFeatureState();
    setCursor('');
  }

  function onMouseEnter(e: { features?: Array<{ properties?: Record<string, unknown> }> }): void {
    if (!map) return;
    const features = e?.features;
    if (!features || features.length === 0) {
      clearHoverState();
      return;
    }

    // Set cursor to pointer
    setCursor('pointer');

    const sourceId = getSourceId(e);
    const featureId = getFeatureId(e);
    if (featureId == null || !sourceId || !map.setFeatureState) return;
    if (map.getSource && !map.getSource(sourceId)) return; // source gone (e.g. style replaced)

    // Clear previous feature state (but not cursor)
    clearFeatureState();
    try {
      map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
      lastHovered = { sourceId, id: featureId };
    } catch {
      // e.g. source has no promoteId
    }
  }

  function onMouseLeave(): void {
    clearHoverState();
  }

  return { onMouseEnter, onMouseLeave };
}
