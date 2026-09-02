import { hexToRgb } from '@twinfile/geokit/core';

export interface RouteProgressGradientOptions {
  /** CSS hex color for the route */
  color: string;
  /** Progress along the route from 0 (start) to 1 (end) */
  progress: number;
  /** Opacity for the traveled portion (default 0.55) */
  trailOpacity?: number;
  /** Opacity for the remaining portion (default 0.35) */
  aheadOpacity?: number;
  /** Small offset subtracted from progress to align marker and line rendering */
  progressOffset?: number;
}

/**
 * Build a MapLibre `line-gradient` expression that highlights traveled route progress.
 * Requires a GeoJSON line source with `lineMetrics: true`.
 */
export function buildRouteProgressGradient(
  options: RouteProgressGradientOptions
): unknown[] {
  const rgb = hexToRgb(options.color);
  const trailOpacity = options.trailOpacity ?? 0.55;
  const aheadOpacity = options.aheadOpacity ?? 0.35;
  const progressOffset = options.progressOffset ?? 0.005;
  const adjustedProgress = Math.max(0, Math.min(1, options.progress - progressOffset));

  return [
    'step',
    ['line-progress'],
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${trailOpacity})`,
    adjustedProgress,
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${aheadOpacity})`,
  ];
}
