/**
 * Feature-state hover utilities
 *
 * Single place for hover highlight logic: set/clear feature-state and
 * build data-driven opacity expressions. Used by PointElement and by
 * apps (e.g. venue layers) that render many points from one source.
 */

// Minimal map interface for feature-state and cursor (avoids pulling full MapInstance).
// getCanvas may return a canvas-like object (some providers return a wrapper).
export interface MapWithFeatureState {
  setFeatureState?(state: { source: string; id: string | number }, props: { hover: boolean }): void;
  removeFeatureState?(state: { source: string; id: string | number }): void;
  getCanvas?(): { style?: { cursor?: string } } | undefined;
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

/** Default opacity when hovered (highlight glow) */
export const HOVER_GLOW_OPACITY = 0.75;

/** Default opacity for point circle when hovered */
export const HOVER_POINT_OPACITY = 1;

/**
 * Build MapLibre circle-opacity expression: hover => hoverOpacity, else defaultOpacity.
 * Use with a source that has promoteId and layers that receive feature-state from setFeatureState.
 * defaultOpacity can be a number or a data-driven expression (e.g. rating-based opacity).
 */
export function buildOpacityWithHoverExpression(
  defaultOpacity: number | unknown[],
  hoverOpacity: number
): unknown[] {
  return ['case', ['boolean', ['feature-state', 'hover'], false], hoverOpacity, defaultOpacity];
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

  function clearHoverState(): void {
    if (lastHovered && map?.removeFeatureState) {
      try {
        map.removeFeatureState({ source: lastHovered.sourceId, id: lastHovered.id });
      } catch {
        // ignore
      }
      lastHovered = null;
    }
    const canvas = map?.getCanvas?.();
    if (canvas?.style) canvas.style.cursor = '';
  }

  function onMouseEnter(e: { features?: Array<{ properties?: Record<string, unknown> }> }): void {
    if (!map) return;
    const features = e?.features;
    if (!features || features.length === 0) {
      clearHoverState();
      return;
    }

    const canvas = map.getCanvas?.();
    if (canvas?.style) canvas.style.cursor = 'pointer';

    const sourceId = getSourceId(e);
    const featureId = getFeatureId(e);
    if (featureId == null || !sourceId || !map.setFeatureState) return;

    clearHoverState();
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
