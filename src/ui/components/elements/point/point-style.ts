/**
 * Point style expressions and paint updates (Single Responsibility: circle radius/opacity expressions)
 */

import { HOVER_CONFIG } from '../../../utils/feature-state-hover';

const BASE_SCALE_DIVISOR = 6;

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
    Math.max(1, 2 * scale),
    5,
    Math.max(1, 3 * scale),
    7,
    Math.max(1, 5 * scale),
    9,
    Math.max(2, 8 * scale),
    11,
    Math.max(3, 12 * scale),
    13,
    Math.max(4, 18 * scale),
    15,
    Math.max(6, 26 * scale),
    17,
    Math.max(8, 36 * scale),
    19,
    Math.max(10, 48 * scale),
  ];
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
  const scale = scaleFromSize(size);
  return [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    3,
    Math.max(2, 3.5 * scale),
    6,
    Math.max(3, 5 * scale),
    8,
    Math.max(5, 8 * scale),
    10,
    Math.max(7, 11 * scale),
    14,
    Math.max(10, 14 * scale),
    18,
    Math.max(14, 18 * scale),
  ];
}

/**
 * Hover glow radius expression (uses HOVER_CONFIG.glowRadiusScale).
 */
export function getHoverGlowRadiusExpression(size: number): unknown[] {
  const scale = scaleFromSize(size);
  const hoverScale = HOVER_CONFIG.glowRadiusScale;
  return [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    3,
    Math.max(2, 3.5 * scale * hoverScale),
    6,
    Math.max(3, 5 * scale * hoverScale),
    8,
    Math.max(5, 8 * scale * hoverScale),
    10,
    Math.max(7, 11 * scale * hoverScale),
    14,
    Math.max(10, 14 * scale * hoverScale),
    18,
    Math.max(14, 18 * scale * hoverScale),
  ];
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
