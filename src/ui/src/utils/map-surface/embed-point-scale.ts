/**
 * Compact embed scaling for shared point layers — shrink radii when the map
 * container is shorter than a reference height (e.g. sidebar strip vs full card).
 */

import type { MapInstance } from '../../providers/types';
import { multiplyRadiusExpression } from '../layers/styles/index';
import type { ApplySharedPointPaintOptions } from '../paint/shared-point-paint';

export const DEFAULT_EMBED_REFERENCE_HEIGHT_PX = 400;
/** Reference height for short sidebar strips (~180px) so embed scale shrinks further. */
export const COMPACT_SIDEBAR_REFERENCE_HEIGHT_PX = 528;
export const DEFAULT_EMBED_MIN_SCALE = 0.35;
/** Lower floor for compact embed maps so dense continental views can shrink below 3px. */
/** Safari and dense sidebar maps need ≥2px or circles vanish. */
export const COMPACT_EMBED_MIN_RADIUS_PX = 2;
/** No blur on compact embed glow — circle-blur softens tiny points into fuzzy halos. */
export const COMPACT_EMBED_GLOW_BLUR = 0;
/** Above this zoom, embed shrink is not applied — points grow with zoom when inspecting points. */
export const COMPACT_EMBED_ZOOM_GROWTH_THRESHOLD = 8;

export interface EmbedPointScaleFromHeightOptions {
  referenceHeightPx?: number;
  minScale?: number;
  maxScale?: number;
}

/** Scale multiplier from container height (1 = reference height or taller). */
export function embedPointScaleFromHeight(
  heightPx: number,
  options: EmbedPointScaleFromHeightOptions = {}
): number {
  const reference = options.referenceHeightPx ?? DEFAULT_EMBED_REFERENCE_HEIGHT_PX;
  const minScale = options.minScale ?? DEFAULT_EMBED_MIN_SCALE;
  const maxScale = options.maxScale ?? 1;
  if (!Number.isFinite(heightPx) || heightPx <= 0 || reference <= 0) return 1;
  if (heightPx >= reference) return maxScale;
  return Math.max(minScale, Math.min(maxScale, heightPx / reference));
}

export interface ResolveEmbedPointScaleOptions extends EmbedPointScaleFromHeightOptions {
  map?: MapInstance | null;
  container?: HTMLElement | null;
  /** Explicit multiplier; skips height detection when set. Capped at maxScale. */
  embedPointScale?: number;
  /** Derive scale from map/container height when true. */
  compactPoints?: boolean;
}

function readContainerHeight(container: HTMLElement | null | undefined): number {
  if (!container) return 0;
  const height = container.clientHeight;
  return Number.isFinite(height) && height > 0 ? height : 0;
}

/** Resolve embed scale for shared point layers (1 = no shrink). */
export function resolveEmbedPointScale(options: ResolveEmbedPointScaleOptions = {}): number {
  const maxScale = options.maxScale ?? 1;
  const explicit = options.embedPointScale;
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return Math.min(maxScale, explicit);
  }
  if (!options.compactPoints) return 1;

  const container =
    options.container ??
    (options.map as { getContainer?: () => HTMLElement })?.getContainer?.() ??
    null;

  const height = readContainerHeight(container);
  if (height <= 0) return 1;

  return embedPointScaleFromHeight(height, options);
}

function scaleCompactEmbedRadiusInterpolation(
  interpolate: unknown[],
  embedScale: number,
  minRadiusPx: number
): unknown[] {
  if (
    !Array.isArray(interpolate) ||
    interpolate[0] !== 'interpolate' ||
    typeof embedScale !== 'number' ||
    embedScale === 1
  ) {
    return interpolate;
  }

  const scaled = [...interpolate];
  for (let i = 4; i < scaled.length; i += 2) {
    const zoom = scaled[i - 1];
    if (typeof zoom !== 'number' || typeof scaled[i] !== 'number') continue;
    if (zoom < COMPACT_EMBED_ZOOM_GROWTH_THRESHOLD) {
      scaled[i] = Math.max(minRadiusPx, (scaled[i] as number) * embedScale);
    }
  }
  return scaled;
}

function scalePointRadiusExpressionForCompactEmbed(expr: unknown[], embedScale: number): unknown[] {
  if (expr[0] === 'literal' && typeof expr[1] === 'number') {
    return ['literal', Math.max(COMPACT_EMBED_MIN_RADIUS_PX, expr[1] * embedScale)];
  }
  if (expr[0] === 'interpolate') {
    return scaleCompactEmbedRadiusInterpolation(expr, embedScale, COMPACT_EMBED_MIN_RADIUS_PX);
  }
  if (expr[0] === '*' && Array.isArray(expr[1]) && (expr[1] as unknown[])[0] === 'interpolate') {
    return [
      '*',
      scaleCompactEmbedRadiusInterpolation(
        expr[1] as unknown[],
        embedScale,
        COMPACT_EMBED_MIN_RADIUS_PX
      ),
      ...expr.slice(2),
    ];
  }
  return multiplyRadiusExpression(expr, embedScale, {
    minRadiusPx: COMPACT_EMBED_MIN_RADIUS_PX,
  });
}

/** Apply embed scale to shared point paint (radius only). */
export function scaleSharedPointPaintForEmbed(
  paint: ApplySharedPointPaintOptions,
  embedScale: number
): ApplySharedPointPaintOptions {
  if (embedScale === 1) return paint;
  const expr = paint.pointRadiusExpression;
  if (!Array.isArray(expr)) return paint;
  return {
    ...paint,
    pointRadiusExpression: scalePointRadiusExpressionForCompactEmbed(expr as unknown[], embedScale),
  };
}

export interface SharedPointEmbedLayerOptions {
  map: MapInstance;
  paint: ApplySharedPointPaintOptions;
  glowHitAreaScale: number;
  compactPoints?: boolean;
  embedPointScale?: number;
  referenceHeightPx?: number;
  minScale?: number;
}

/** Resolve embed scale and return scaled paint + glow hit scale. */
export function applyEmbedScaleToSharedPointLayerOptions(options: SharedPointEmbedLayerOptions): {
  paint: ApplySharedPointPaintOptions;
  glowHitAreaScale: number;
  embedScale: number;
} {
  const embedScale = resolveEmbedPointScale({
    map: options.map,
    compactPoints: options.compactPoints,
    embedPointScale: options.embedPointScale,
    referenceHeightPx: options.referenceHeightPx,
    minScale: options.minScale,
  });

  if (embedScale === 1) {
    return {
      paint: options.paint,
      glowHitAreaScale: options.glowHitAreaScale,
      embedScale: 1,
    };
  }

  return {
    paint: scaleSharedPointPaintForEmbed(options.paint, embedScale),
    glowHitAreaScale: options.glowHitAreaScale * embedScale,
    embedScale,
  };
}
