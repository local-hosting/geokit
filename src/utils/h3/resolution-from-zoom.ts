/** Default H3 resolution bounds for zoom-derived resolution (protomap-style). */
export const H3_RESOLUTION_FROM_ZOOM_MIN = 6;
export const H3_RESOLUTION_FROM_ZOOM_MAX = 15;

/** Zoom multiplier before rounding (16/23 ≈ protomap marker resolution curve). */
export const H3_RESOLUTION_FROM_ZOOM_FACTOR = 16 / 23;

export type H3ResolutionFromZoomOptions = {
  min?: number;
  max?: number;
  /** Multiplier applied to map zoom before rounding. */
  zoomFactor?: number;
};

function clampH3Resolution(value: number, min: number, max: number): number {
  const rounded = Math.round(value);
  return Math.min(Math.max(rounded, min), max);
}

/**
 * Map viewport zoom to an H3 resolution (integer 0–15).
 *
 * Uses `round(zoom * zoomFactor)` clamped to `[min, max]`. Defaults match protomap:
 * factor `16/23`, min `6`, max `15`.
 *
 * @example
 * ```typescript
 * h3ResolutionFromZoom(12); // 8
 * coordinatesToH3(h3ResolutionFromZoom(map.getZoom()))([lat, lng]);
 * ```
 */
export function h3ResolutionFromZoom(
  zoom: number,
  options: H3ResolutionFromZoomOptions = {}
): number {
  const min = options.min ?? H3_RESOLUTION_FROM_ZOOM_MIN;
  const max = options.max ?? H3_RESOLUTION_FROM_ZOOM_MAX;
  const zoomFactor = options.zoomFactor ?? H3_RESOLUTION_FROM_ZOOM_FACTOR;
  return clampH3Resolution(zoom * zoomFactor, min, max);
}
