/**
 * Point style expressions and paint updates (Single Responsibility: circle radius/opacity expressions)
 */

const BASE_SCALE_DIVISOR = 6;
const GLOW_HIT_PADDING_PX = 2;
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
const HOVER_GLOW_PADDING_PX = 3.5;

function scaleFromSize(size: number): number {
  return size / BASE_SCALE_DIVISOR;
}

/**
 * Zoom-based circle radius expression for main point (exponential interpolation).
 */
export function getZoomRadiusExpression(size: number): unknown[] {
  const scale = scaleFromSize(size);
  return [
    'interpolate',
    ['exponential', 1.8],
    ['zoom'],
    3,
    Math.max(2, 2.8 * scale),
    5,
    Math.max(2.5, 4.2 * scale),
    7,
    Math.max(3, 7 * scale),
    9,
    Math.max(3.5, 11.2 * scale),
    11,
    Math.max(4.5, 16.8 * scale),
    13,
    Math.max(6, 25.2 * scale),
    15,
    Math.max(8, 36.4 * scale),
    17,
    Math.max(10, 50.4 * scale),
    19,
    Math.max(12, 67.2 * scale),
  ];
}

/** Selection ring stroke (px); ring center sits outside the point fill by gap + half stroke. */
export const POINT_SELECTION_RING_STROKE_WIDTH = 2;
const POINT_SELECTION_RING_GAP_PX = 0.5;

/**
 * Selection ring radius: hugs the point with a small gap (not the same radius as the fill).
 */
export function getSelectionRingRadiusExpression(size: number): unknown[] {
  const offset = POINT_SELECTION_RING_GAP_PX + POINT_SELECTION_RING_STROKE_WIDTH / 2;
  return offsetRadiusInterpolation(getZoomRadiusExpression(size), offset);
}

/**
 * Shadow layer radius expression (slightly larger than main point).
 */
export function getShadowRadiusExpression(size: number): unknown[] {
  const scale = scaleFromSize(size);
  return [
    'interpolate',
    ['exponential', 1.8],
    ['zoom'],
    3,
    Math.max(1, 3 * scale),
    5,
    Math.max(1, 4 * scale),
    7,
    Math.max(2, 7 * scale),
    9,
    Math.max(3, 11 * scale),
    11,
    Math.max(4, 16 * scale),
    13,
    Math.max(6, 24 * scale),
    15,
    Math.max(8, 34 * scale),
    17,
    Math.max(10, 46 * scale),
    19,
    Math.max(12, 60 * scale),
  ];
}

/**
 * Glow layer radius expression (halo behind point).
 */
export function getGlowRadiusExpression(size: number): unknown[] {
  return offsetRadiusInterpolation(getZoomRadiusExpression(size), GLOW_HIT_PADDING_PX);
}

/**
 * Hover glow radius expression.
 */
export function getHoverGlowRadiusExpression(size: number): unknown[] {
  return offsetRadiusInterpolation(getZoomRadiusExpression(size), HOVER_GLOW_PADDING_PX);
}

export interface PointPaintOptions {
  size: number;
  color: string;
  opacity: number;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity: number;
}

/**
 * Apply main point layer paint properties (circle-radius, color, opacity, stroke).
 * Used by PointElement.updatePointStyle. Fails silently; caller may fall back to addPoint().
 */
export function applyPointPaintProperties(
  map: {
    setPaintProperty?: (layerId: string, name: string, value: unknown) => void;
  } | null,
  layerId: string | null,
  options: PointPaintOptions
): void {
  if (!map?.setPaintProperty || !layerId) return;
  try {
    map.setPaintProperty(layerId, 'circle-radius', getZoomRadiusExpression(options.size));
    map.setPaintProperty(layerId, 'circle-color', options.color);
    map.setPaintProperty(layerId, 'circle-opacity', options.opacity);
    if (options.strokeWidth > 0) {
      map.setPaintProperty(layerId, 'circle-stroke-width', options.strokeWidth);
      map.setPaintProperty(layerId, 'circle-stroke-color', options.strokeColor);
      map.setPaintProperty(layerId, 'circle-stroke-opacity', options.strokeOpacity);
    } else {
      map.setPaintProperty(layerId, 'circle-stroke-width', 0);
    }
  } catch {
    // Caller may recreate point
  }
}
