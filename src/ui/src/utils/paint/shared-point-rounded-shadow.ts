import type { MapInstance } from '../../providers/types';
import { styleImageLayoutPixels } from '../map-surface/map-style-images';
import { scaleInterpolateRadiusStops } from './shared-point-paint';

/** Pre-blurred black rounded rect (non-SDF) — legacy sprite id; no longer painted. */
export const GK_ROUNDED_RECT_SHADOW_IMAGE_ID = 'gk-marker-rounded-rect-shadow';

export function sharedPointRoundedShadowLayerId(pointLayerId: string): string {
  return `${pointLayerId}-rounded-shadow`;
}

export function sharedPointSelectionRoundedShadowLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-rounded-shadow`;
}

/** `icon-size` so the rounded shadow spans the same radius as the circle shadow. */
export function sharedPointRoundedShadowIconSizeExpression(shadowRadius: unknown): unknown {
  const perRadius = 2 / styleImageLayoutPixels();
  if (Array.isArray(shadowRadius) && shadowRadius[0] === 'interpolate') {
    return scaleInterpolateRadiusStops(shadowRadius, perRadius);
  }
  return typeof shadowRadius === 'number'
    ? shadowRadius * perRadius
    : ['*', shadowRadius, perRadius];
}

export type EnsureRoundedShadowLayerOptions = {
  layerId: string;
  source: string;
  shadowRadius: unknown;
  opacity: unknown;
  translate: unknown;
  beforeId?: string;
};

/** Hide legacy rounded-rect sprite shadows — soft circle glow casts for every shape. */
export function hideRoundedShadowLayer(map: MapInstance, layerId: string): void {
  if (!map.getLayer?.(layerId) || !map.setLayoutProperty) return;
  try {
    map.setLayoutProperty(layerId, 'visibility', 'none');
  } catch {
    /* style swap */
  }
}

/** @deprecated Prefer {@link hideRoundedShadowLayer} — square sprites never read as soft shadows. */
export function ensureRoundedShadowLayer(
  map: MapInstance,
  options: EnsureRoundedShadowLayerOptions
): void {
  hideRoundedShadowLayer(map, options.layerId);
}
