import type { MapInstance } from '../../providers/types';
import { styleImageLayoutPixels } from '../map-surface/map-style-images';
import { sharedPointRoundedRectBodyFilter } from '../markers/marker-shape';
import { scaleInterpolateRadiusStops } from './shared-point-paint';

/** Pre-blurred black rounded rect (non-SDF), same geometry as the badge rect sprite. */
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

/** Add (or repaint) a rounded drop-shadow symbol layer. */
export function ensureRoundedShadowLayer(
  map: MapInstance,
  options: EnsureRoundedShadowLayerOptions
): void {
  const iconSize = sharedPointRoundedShadowIconSizeExpression(options.shadowRadius);
  const paint: Record<string, unknown> = {
    'icon-opacity': options.opacity,
    'icon-translate': options.translate,
    'icon-translate-anchor': 'viewport',
  };
  if (map.getLayer?.(options.layerId)) {
    try {
      for (const [key, value] of Object.entries(paint)) {
        map.setPaintProperty?.(options.layerId, key, value);
      }
      map.setLayoutProperty?.(options.layerId, 'icon-size', iconSize);
    } catch {
      /* style swap */
    }
    return;
  }
  if (!map.getSource?.(options.source)) return;
  try {
    map.addLayer?.(
      {
        id: options.layerId,
        type: 'symbol',
        source: options.source,
        filter: sharedPointRoundedRectBodyFilter(),
        layout: {
          'icon-image': GK_ROUNDED_RECT_SHADOW_IMAGE_ID,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-anchor': 'center',
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
          'icon-size': iconSize,
        },
        paint,
      } as never,
      options.beforeId
    );
  } catch {
    /* style swap */
  }
}
