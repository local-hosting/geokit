/**
 * Feature-state hover utilities
 *
 * Single place for hover highlight logic: set/clear feature-state and
 * build data-driven opacity expressions. Used by PointElement and by
 * apps (e.g. shared point layers) that render many points from one source.
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
  glowRadiusScale: 1.45,

  /** Default glow opacity on dedicated hover layer */
  glowOpacity: 0.65,

  /** Blur for hover glow (MapLibre 0–1; keep below 1 to avoid muddy halos) */
  glowBlur: 0.55,

  /** Point stroke width on hover (0 = glow-only hover feedback) */
  pointStrokeWidth: 0,

  /** Point stroke color on hover (unused when pointStrokeWidth is 0) */
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

function scaleInterpolateRadiusStops(interpolate: unknown[], scale: number): unknown[] {
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
      scaled[i] = (scaled[i] as number) * scale;
    }
  }
  return scaled;
}

export function scaleRadiusForHover(baseRadius: unknown[] | number): unknown[] | number {
  const scale = HOVER_CONFIG.glowRadiusScale;
  if (typeof baseRadius === 'number') {
    return baseRadius * scale;
  }
  if (Array.isArray(baseRadius) && baseRadius[0] === 'interpolate') {
    return scaleInterpolateRadiusStops(baseRadius, scale);
  }
  if (
    Array.isArray(baseRadius) &&
    baseRadius[0] === '*' &&
    Array.isArray(baseRadius[1]) &&
    baseRadius[1][0] === 'interpolate'
  ) {
    return ['*', scaleInterpolateRadiusStops(baseRadius[1], scale), baseRadius[2]];
  }
  return ['*', baseRadius, scale];
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
 * Grounded badge selection: hide the resting stack on the main source while
 * `feature-state.selected` is set (selection source draws the lifted badge).
 */
export function buildOpacityHideRestingWhenSelectedExpression(
  defaultOpacity: number | unknown[] | string,
  hoverOpacity: number | string = HOVER_CONFIG.pointOpacity,
  selectedOpacity = 0
): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedOpacity,
    ['boolean', ['feature-state', 'hover'], false],
    hoverOpacity,
    defaultOpacity,
  ];
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
