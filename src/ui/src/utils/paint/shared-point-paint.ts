/**
 * MapLibre paint/layout expressions for shared point layers.
 *
 * Prefer pre-computing colors on feature properties (_color) and using simple
 * coalesce/get expressions — complex data-driven paint causes MapTiler to drop
 * features at low zoom when per-tile rendering budgets are exceeded.
 */

import type { FeatureCollection, Point } from 'geojson';
import type { MapInstance } from '../../providers/types';
import {
  buildOpacityWithHoverExpression,
  HOVER_CONFIG,
  scaleRadiusForHover,
} from '../map-surface/feature-state-hover';
import { getCSSVariable, getCSSVariableNumber } from '../map-surface/theme';

/** Min point radius (px). Safari needs ≥2px or circles can vanish when zoomed out. */
export const SHARED_POINT_MIN_RADIUS_PX = 2.8;

/** Default glow opacity for shared point layers. */
export const SHARED_POINT_UNIFORM_GLOW_OPACITY = 0.24;

/** Prod-visible hero glow opacity (matches --gk-point-glow-opacity). */
export const SHARED_POINT_DEFAULT_GLOW_OPACITY = 0.4;

/** Prod-visible hero glow blur. */
export const SHARED_POINT_DEFAULT_GLOW_BLUR = 1.5;

/** Soft edge for glow halos (higher = more fade at edge). */
export const SHARED_POINT_GLOW_BLUR = 2.75;

/** Scale glow radius vs point radius for a larger click/hover hit area. */
export const SHARED_POINT_GLOW_HIT_AREA_SCALE = 2.5;

/** Default glow hover opacity when the app does not pass a theme-specific value. */
export const SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY = 0.65;

/** Non-primary values render slightly smaller when using brand-based radius scaling. */
export const SHARED_POINT_SECONDARY_RADIUS_SCALE = 0.9;

/** Point radius by zoom — slightly larger at high zoom for visibility. */
export const SHARED_POINT_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  0,
  SHARED_POINT_MIN_RADIUS_PX,
  2,
  SHARED_POINT_MIN_RADIUS_PX,
  6,
  SHARED_POINT_MIN_RADIUS_PX,
  10,
  2.6,
  14,
  3.8,
  18,
  6,
];

/** Hover glow radius — uniform for all features. */
export const SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  0,
  4,
  6,
  8,
  10,
  12,
  14,
  18,
  18,
  26,
];

/**
 * Floating-badge style (alongside the standard filled-dot + hit-area glow):
 * soft/white center → colored ring → outer stroke → ground shadow under a floated badge.
 * Radius tracks map zoom — readable at city scale, larger when zoomed in.
 */
/** Bump when floating-badge size/look constants change so apps re-apply paint. */
export const SHARED_POINT_FLOATING_BADGE_PAINT_REVISION = 19;

export const SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['exponential', 1.75],
  ['zoom'],
  0,
  1.5,
  4,
  1.75,
  6,
  2.25,
  8,
  3.25,
  10,
  6.5,
  12,
  13,
  14,
  22,
  16,
  34,
  18,
  44,
];

/** Colored ring width — thin when zoomed out, full token width when close in. */
export function sharedPointFloatingBadgeRingWidthExpression(
  maxWidth = SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH
): unknown[] {
  return [
    'interpolate',
    ['exponential', 1.75],
    ['zoom'],
    0,
    Math.max(1.25, maxWidth * 0.2),
    6,
    Math.max(1.75, maxWidth * 0.28),
    8,
    maxWidth * 0.4,
    10,
    maxWidth * 0.55,
    12,
    maxWidth * 0.75,
    14,
    maxWidth * 1.35,
    16,
    maxWidth * 1.6,
    18,
    maxWidth * 1.85,
  ];
}

/** Outer stroke width — scales with zoom alongside the ring. */
export function sharedPointFloatingBadgeOuterStrokeWidthExpression(
  maxWidth = SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH
): unknown[] {
  return [
    'interpolate',
    ['exponential', 1.75],
    ['zoom'],
    0,
    Math.max(0.6, maxWidth * 0.28),
    6,
    maxWidth * 0.4,
    10,
    maxWidth * 0.6,
    14,
    maxWidth * 1.35,
    16,
    maxWidth * 1.6,
    18,
    maxWidth * 1.85,
  ];
}

export const SHARED_POINT_FLOATING_BADGE_FILL = '#ffffff';
/** Unselected inner fill + outer stroke — light tint of the key color (white = selected only). */
export const SHARED_POINT_FLOATING_BADGE_SOFT_LIGHTEN = 0.55;
export const SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY = '_colorSoft';
/** Frosted disc behind unselected badges (MapLibre blur stand-in for glass). */
export const SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY = 0.38;
export const SHARED_POINT_FLOATING_BADGE_GLASS_BLUR = 0.65;
/** Tight frost bloom — must stay smaller than the ground shadow after float. */
export const SHARED_POINT_FLOATING_BADGE_GLASS_PAD = 1.5;
export const SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH = 7;
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH = 2.5;
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR = '#ffffff';
/** Unselected key ring — slight see-through for a glassier edge. */
export const SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY = 0.82;
/** Outer white stroke — nearly opaque so badges read on green/light basemaps. */
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY = 0.95;
export const SHARED_POINT_FLOATING_BADGE_SHADOW_COLOR = '#000000';
/** Soft ground contact — translucent so basemap detail still reads through. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY = 0.28;
/** Soft edge so the shadow reads as diffuse contact, not a sharp ellipse. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR = 0.55;
/**
 * Pad past the fill so the ellipse peeks under ring + outer + glass after float.
 * Zoom stops keep continental pads tiny (no fat black disks).
 */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD = 10;
/** South-biased cast — light from above; peeks under the badge’s south edge. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE: [number, number] = [1, 5];
/** Resting viewport lift — unselected badges sit clearly above the ground shadow (deep zoom max). */
export const SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE: [number, number] = [0, -24];
/** Active/selected badge — lowered toward the map, shadow stays put (deep zoom max). */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE: [number, number] = [0, -14];
export const SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS = 180;
/** Hover ring color lerp duration (linear — instant start/stop, fluid mid). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS = 120;
/** Mix toward white on hover (0–1) — lighter tint of the key ring color. */
export const SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN = 0.5;
/** Outer white stroke width on hover — unused (stroke stays put). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_OUTER_STROKE_WIDTH = 4.5;
/** Hover keeps resting height — lighten only, no raise/lower (deep zoom max). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_TRANSLATE: [number, number] = [0, -24];
/** Scale ground-shadow radius while hovered (< 1). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_SHADOW_SCALE = 0.78;
/** Scale ground-shadow radius while selected (> 1). */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_SCALE = 1.22;
/** Ground-shadow opacity while selected (slightly stronger than resting). */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_OPACITY = 0.32;
/**
 * Float height as a fraction of max Y by zoom — near 0 when zoomed out so dots stay on points.
 * City zooms lift enough that frosted glass clears the ground shadow.
 * Stops: [zoom, fraction].
 */
export const SHARED_POINT_FLOATING_BADGE_FLOAT_Y_ZOOM_STOPS: [number, number][] = [
  [6, 0],
  [8, 0.18],
  [10, 0.4],
  [12, 0.6],
  [14, 0.8],
  [16, 0.92],
  [18, 1],
];
/** Shadow pad fraction by zoom — tiny when zoomed out so ground contact matches the dot. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_PAD_ZOOM_STOPS: [number, number][] = [
  [6, 0.08],
  [8, 0.22],
  [10, 0.55],
  [12, 0.78],
  [14, 0.92],
  [16, 1],
  [18, 1],
];
/** Shadow opacity / blur / cast fraction by zoom — readable by city zoom, faint far out. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_STRENGTH_ZOOM_STOPS: [number, number][] = [
  [6, 0.28],
  [8, 0.5],
  [10, 0.72],
  [12, 0.88],
  [14, 0.96],
  [16, 1],
  [18, 1],
];
export const SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT = 'map' as const;
export const SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE = 'map' as const;
export const SHARED_POINT_FLOATING_BADGE_SELECTION_SHADOW_COLOR = 'rgba(0, 0, 0, 0.32)';
/** Floating-badge select = lowered badge only — no halo (transparent if anything restores stroke). */
export const SHARED_POINT_FLOATING_BADGE_SELECTION_RING_COLOR = 'rgba(0, 0, 0, 0)';
/** Selected badge keeps the same radius (only height changes). */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE = 1;
export const SHARED_POINT_FLOATING_BADGE_RING_STROKE_WIDTH =
  SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH +
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH;

/** `case` on feature-state `selected` (requires source `promoteId`). */
export function sharedPointFeatureStateSelectedCase(
  selectedValue: unknown,
  defaultValue: unknown
): unknown[] {
  return [
    'case',
    ['boolean', ['feature-state', 'selected'], false],
    selectedValue,
    defaultValue,
  ];
}

/**
 * Filter that drops one feature from floating layers while a grounded selection badge shows.
 * Prefer this over feature-state opacity — MapTiler helper sources often lack promoteId.
 */
export function sharedPointExcludeFeatureIdFilter(
  promoteId: string,
  featureId: string | null | undefined
): unknown[] | null {
  if (featureId == null || featureId === '') return null;
  return ['!=', ['to-string', ['get', promoteId]], String(featureId)];
}

/** Exclude several feature ids (e.g. selected + hovered) from floating badge layers. */
export function sharedPointExcludeFeatureIdsFilter(
  promoteId: string,
  featureIds: Array<string | null | undefined>
): unknown[] | null {
  const ids = [
    ...new Set(
      featureIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  if (ids.length === 0) return null;
  if (ids.length === 1) return sharedPointExcludeFeatureIdFilter(promoteId, ids[0]);
  return [
    'all',
    ...ids.map((id) => ['!=', ['to-string', ['get', promoteId]], String(id)]),
  ];
}

export type SyncSharedPointSelectedLayerFilterOptions = {
  pointLayerId: string;
  glowLayerId?: string;
  promoteId: string;
  featureId: string | null;
};

/** Hide/show the floating badge stack for the selected feature via layer filter. */
export function syncSharedPointSelectedLayerFilter(
  map: {
    getLayer?(id: string): unknown;
    setFilter?(id: string, filter: unknown[] | null): void;
  },
  options: SyncSharedPointSelectedLayerFilterOptions
): void {
  if (!map.setFilter) return;
  const filter = sharedPointExcludeFeatureIdFilter(options.promoteId, options.featureId);
  // Hide floating badge + resting glow; selection source draws the lowered badge + stronger shadow.
  const glowLayerId =
    options.glowLayerId ??
    (options.pointLayerId.endsWith('-point')
      ? `${options.pointLayerId.slice(0, -'-point'.length)}-glow`
      : undefined);
  const layerIds = [
    options.pointLayerId,
    sharedPointOuterStrokeLayerId(options.pointLayerId),
    sharedPointGlassLayerId(options.pointLayerId),
    glowLayerId,
  ].filter((id): id is string => typeof id === 'string' && id.length > 0);

  for (const layerId of layerIds) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setFilter(layerId, filter);
    } catch {
      /* layer may reject filter briefly during style swap */
    }
  }
}

export function scaleInterpolateRadiusStops(interpolate: unknown[], scale: number): unknown[] {
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

/**
 * MapTiler rejects `['*', interpolate, case|match]`. Expand into case branches with
 * scaled interpolate stops per branch.
 */
export function expandInterpolateCaseMultiply(
  interpolate: unknown[],
  caseExpression: unknown[],
  outerScale = 1
): unknown[] {
  if (
    !Array.isArray(caseExpression) ||
    caseExpression[0] !== 'case' ||
    !Array.isArray(interpolate) ||
    interpolate[0] !== 'interpolate'
  ) {
    return ['*', interpolate, caseExpression];
  }

  const expanded: unknown[] = ['case'];
  for (let i = 1; i < caseExpression.length - 1; i += 2) {
    expanded.push(caseExpression[i]);
    const branchScale = caseExpression[i + 1];
    const scale =
      typeof branchScale === 'number' ? branchScale * outerScale : outerScale;
    expanded.push(scaleInterpolateRadiusStops(interpolate, scale));
  }
  const defaultBranch = caseExpression[caseExpression.length - 1];
  const defaultScale =
    typeof defaultBranch === 'number' ? defaultBranch * outerScale : outerScale;
  expanded.push(scaleInterpolateRadiusStops(interpolate, defaultScale));
  return expanded;
}

function isInterpolateCaseMultiplyExpression(
  expression: unknown[]
): expression is ['*', unknown[], unknown[]] {
  return (
    expression[0] === '*' &&
    Array.isArray(expression[1]) &&
    expression[1][0] === 'interpolate' &&
    Array.isArray(expression[2]) &&
    expression[2][0] === 'case'
  );
}

/** MapTiler-safe glow radius derived from the point radius expression. */
export function sharedPointGlowRadiusFromPointExpression(
  pointRadiusExpression: unknown[],
  hitAreaScale: number = SHARED_POINT_GLOW_HIT_AREA_SCALE
): unknown[] {
  if (Array.isArray(pointRadiusExpression) && pointRadiusExpression[0] === 'interpolate') {
    return scaleInterpolateRadiusStops(pointRadiusExpression, hitAreaScale);
  }
  if (isInterpolateCaseMultiplyExpression(pointRadiusExpression)) {
    return expandInterpolateCaseMultiply(
      pointRadiusExpression[1] as unknown[],
      pointRadiusExpression[2] as unknown[],
      hitAreaScale
    );
  }
  if (
    Array.isArray(pointRadiusExpression) &&
    pointRadiusExpression[0] === '*' &&
    Array.isArray(pointRadiusExpression[1]) &&
    pointRadiusExpression[1][0] === 'interpolate'
  ) {
    return [
      '*',
      scaleInterpolateRadiusStops(pointRadiusExpression[1], hitAreaScale),
      pointRadiusExpression[2],
    ];
  }
  return ['*', pointRadiusExpression, hitAreaScale];
}

export function paintColorFromProperty(property = '_color', fallback = '#888888'): unknown[] {
  return ['coalesce', ['get', property], fallback];
}

export function sharedPointRadiusByPropertyExpression(
  property: string,
  primaryValue: string,
  secondaryScale = SHARED_POINT_SECONDARY_RADIUS_SCALE
): unknown[] {
  if (!primaryValue) {
    return SHARED_POINT_RADIUS_EXPRESSION;
  }
  return [
    '*',
    SHARED_POINT_RADIUS_EXPRESSION,
    ['case', ['==', ['get', property], ['literal', primaryValue]], 1, secondaryScale],
  ];
}

export function sharedPointColorExpression(options: {
  colorProperty?: string;
  colorFallback?: string;
  primaryProperty?: string;
  primaryValue?: string;
  primaryFillColor?: string;
  hasSecondaryValues?: boolean;
}): unknown[] {
  const {
    colorProperty = '_color',
    colorFallback = '#888888',
    primaryProperty = 'brand',
    primaryValue = '',
    primaryFillColor = '#ffffff',
    hasSecondaryValues = false,
  } = options;

  const base = paintColorFromProperty(colorProperty, colorFallback);
  if (!hasSecondaryValues || !primaryValue) {
    return base;
  }
  return [
    'case',
    ['==', ['get', primaryProperty], ['literal', primaryValue]],
    primaryFillColor,
    base,
  ];
}

export function circleSortKeyByProperty(property: string, value: string): unknown[] {
  if (!value) {
    return ['literal', 0];
  }
  return ['case', ['==', ['get', property], ['literal', value]], 1, 0];
}

export function sharedPointStrokeWidthExpression(): unknown[] {
  return ['literal', 0];
}

export function sharedPointStrokeColorExpression(): unknown[] {
  return ['literal', 'rgba(0,0,0,0)'];
}

/** Default circle-stroke-width when outlining points from fill color. */
export const SHARED_POINT_STROKE_FROM_FILL_WIDTH = 1.25;

/** Transforms a fill hex into a stroke hex (e.g. Loro pack `blendHexWithBlack`). */
export type SharedPointFillColorTransform = (fillHex: string) => string;

/** Light-basemap outline width derived from fill (not selection ring). */
export function sharedPointStrokeFromFillWidthExpression(
  width: number = SHARED_POINT_STROKE_FROM_FILL_WIDTH
): unknown[] {
  return ['literal', width];
}

/**
 * Stroke color: feature `_stroke` when present, else `transformFill(fallbackFill)`.
 * Pair with `annotatePointFeaturesStrokeFromFill` for per-feature colors.
 * Pass Loro pack identity `blendHexWithBlack` (or similar) as `transformFill`.
 */
export function sharedPointStrokeFromFillColorExpression(
  fallbackFill: string,
  transformFill: SharedPointFillColorTransform,
  strokeProperty = '_stroke'
): unknown[] {
  return ['coalesce', ['get', strokeProperty], transformFill(fallbackFill)];
}

export type AnnotatePointStrokeFromFillOptions = {
  fallbackFill: string;
  /** Color transform — typically Loro pack identity `blendHexWithBlack`. */
  transformFill: SharedPointFillColorTransform;
  colorProperty?: string;
  strokeProperty?: string;
  /** When false, returns the collection unchanged. */
  enabled?: boolean;
};

/** Adds `_stroke` from each feature’s fill via `transformFill`. */
export function annotatePointFeaturesStrokeFromFill(
  collection: FeatureCollection<Point>,
  options: AnnotatePointStrokeFromFillOptions
): FeatureCollection<Point> {
  const {
    fallbackFill,
    transformFill,
    colorProperty = '_color',
    strokeProperty = '_stroke',
    enabled = true,
  } = options;
  if (!enabled) return collection;
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const props = feature.properties ?? {};
      const raw = props[colorProperty];
      const fill =
        typeof raw === 'string' && raw.trim() ? raw.trim() : fallbackFill;
      return {
        ...feature,
        properties: {
          ...props,
          [strokeProperty]: transformFill(fill),
        },
      };
    }),
  };
}

export interface SharedPointLayerIds {
  sourceId: string;
  glowLayerId: string;
  pointLayerId: string;
}

/** Outer white (or custom) stroke drawn outside the colored ring. */
export function sharedPointOuterStrokeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-outer-stroke`;
}

export function sharedPointGlassLayerId(pointLayerId: string): string {
  return `${pointLayerId}-glass`;
}

export function sharedPointSelectionBadgeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge`;
}

export function sharedPointSelectionBadgeOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge-outer`;
}

export function sharedPointHoverBadgeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-hover-badge`;
}

export function sharedPointHoverBadgeOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-hover-badge-outer`;
}

export function sharedPointSelectionRingLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-ring`;
}

/**
 * Layers that should receive pointer events for floating-badge / shared points.
 * Omit the opacity-0 selection ring — empty ring hits steal click dedup from real badges.
 */
export function sharedPointHitLayerIds(pointLayerId: string, glowLayerId: string): string[] {
  return [
    glowLayerId,
    pointLayerId,
    sharedPointOuterStrokeLayerId(pointLayerId),
    sharedPointGlassLayerId(pointLayerId),
    sharedPointSelectionBadgeLayerId(pointLayerId),
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
  ];
}

/** Read a numeric paint width from a number or `['literal', n]` expression. */
export function literalNumberFromPaintExpression(expr: unknown, fallback = 0): number {
  if (typeof expr === 'number' && Number.isFinite(expr)) return expr;
  if (Array.isArray(expr) && expr[0] === 'literal' && typeof expr[1] === 'number') {
    return expr[1];
  }
  // Hover case: ['case', cond, hoverValue, restingValue] — layout uses resting width.
  if (Array.isArray(expr) && expr[0] === 'case' && expr.length >= 4) {
    return literalNumberFromPaintExpression(expr[expr.length - 1], fallback);
  }
  return fallback;
}

function isZoomInterpolateExpression(expr: unknown): expr is unknown[] {
  return (
    Array.isArray(expr) &&
    expr[0] === 'interpolate' &&
    Array.isArray(expr[2]) &&
    expr[2][0] === 'zoom'
  );
}

function zoomValueStopsFromInterpolate(expr: unknown[]): [number, number][] {
  const stops: [number, number][] = [];
  for (let i = 3; i < expr.length; i += 2) {
    if (typeof expr[i] === 'number' && typeof expr[i + 1] === 'number') {
      stops.push([expr[i] as number, expr[i + 1] as number]);
    }
  }
  return stops;
}

function exponentialBaseFromInterpolate(expr: unknown[]): number {
  if (Array.isArray(expr[1]) && expr[1][0] === 'exponential' && typeof expr[1][1] === 'number') {
    return expr[1][1];
  }
  return 1;
}

/** Sample a zoom-interpolate curve at `zoom` (piecewise exponential / linear). */
export function sampleZoomInterpolateValue(expr: unknown[], zoom: number): number {
  const stops = zoomValueStopsFromInterpolate(expr);
  if (!stops.length) return 0;
  const base = exponentialBaseFromInterpolate(expr);
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z0, v0] = stops[i - 1];
    const [z1, v1] = stops[i];
    if (zoom <= z1) {
      const u = (zoom - z0) / Math.max(1e-6, z1 - z0);
      const e = base === 1 ? u : (base ** u - 1) / (base - 1);
      return v0 + (v1 - v0) * e;
    }
  }
  return stops[stops.length - 1][1];
}

/**
 * Sum two zoom-interpolate curves into one interpolate.
 * MapLibre rejects `['+', interpolate, interpolate]` for `circle-radius`.
 */
export function mergeZoomInterpolateSum(a: unknown[], b: unknown[]): unknown[] {
  const stopsA = zoomValueStopsFromInterpolate(a);
  const stopsB = zoomValueStopsFromInterpolate(b);
  const zooms = [
    ...new Set([...stopsA.map(([z]) => z), ...stopsB.map(([z]) => z)]),
  ].sort((x, y) => x - y);
  const out: unknown[] = [
    'interpolate',
    a[1] ?? b[1] ?? ['exponential', 1.75],
    ['zoom'],
  ];
  for (const z of zooms) {
    out.push(z, sampleZoomInterpolateValue(a, z) + sampleZoomInterpolateValue(b, z));
  }
  return out;
}

/**
 * Radius where an outer stroke should start: inner fill radius + colored ring width.
 * MapLibre draws circle-stroke outside circle-radius.
 * `strokeWidth` may be a zoom interpolate (badge stack scales with the map).
 */
export function sharedPointRadiusPlusStrokeWidth(
  pointRadius: unknown,
  strokeWidth: number | unknown[]
): unknown {
  if (Array.isArray(strokeWidth)) {
    if (isZoomInterpolateExpression(pointRadius) && isZoomInterpolateExpression(strokeWidth)) {
      return mergeZoomInterpolateSum(pointRadius, strokeWidth);
    }
    if (typeof pointRadius === 'number' && isZoomInterpolateExpression(strokeWidth)) {
      // Fold constant radius into stroke stops — avoid `+` with interpolate.
      const out = [...strokeWidth];
      for (let i = 4; i < out.length; i += 2) {
        if (typeof out[i] === 'number') out[i] = (out[i] as number) + pointRadius;
      }
      return out;
    }
    if (typeof pointRadius === 'number') return ['+', pointRadius, strokeWidth];
    if (Array.isArray(pointRadius)) return ['+', pointRadius, strokeWidth];
    return strokeWidth;
  }
  if (!(strokeWidth > 0)) return pointRadius;
  if (typeof pointRadius === 'number') return pointRadius + strokeWidth;
  if (Array.isArray(pointRadius) && pointRadius[0] === 'interpolate') {
    const result = [...pointRadius];
    for (let i = 4; i < result.length; i += 2) {
      if (typeof result[i] === 'number') {
        result[i] = (result[i] as number) + strokeWidth;
      }
    }
    return result;
  }
  if (Array.isArray(pointRadius)) return ['+', pointRadius, strokeWidth];
  return pointRadius;
}

/** Offset every numeric stop in an interpolate radius (or wrap with `+`). */
export function sharedPointOffsetRadiusExpression(
  pointRadius: unknown[],
  pad: number
): unknown[] {
  if (!Array.isArray(pointRadius) || pointRadius[0] !== 'interpolate') {
    return ['+', pointRadius, pad];
  }
  const next = [...pointRadius];
  for (let i = 4; i < next.length; i += 2) {
    if (typeof next[i] === 'number') next[i] = (next[i] as number) + pad;
  }
  return next;
}

/** Piecewise sample of zoom→fraction stops (matches exponential 1.75 interpolate shape). */
export function sampleSharedPointZoomStopFraction(
  stops: [number, number][],
  zoom: number
): number {
  if (stops.length === 0) return 0;
  if (zoom <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [z0, t0] = stops[i - 1];
    const [z1, t1] = stops[i];
    if (zoom <= z1) {
      const u = (zoom - z0) / Math.max(1e-6, z1 - z0);
      const e = (1.75 ** u - 1) / (1.75 - 1);
      return t0 + (t1 - t0) * e;
    }
  }
  return stops[stops.length - 1][1];
}

/** Viewport translate at a zoom — used by select/hover JS animation. */
export function sharedPointFloatingBadgeTranslateAtZoom(
  maxY: number,
  zoom: number
): [number, number] {
  return [
    0,
    maxY *
      sampleSharedPointZoomStopFraction(SHARED_POINT_FLOATING_BADGE_FLOAT_Y_ZOOM_STOPS, zoom),
  ];
}

/** Zoom-interpolated `circle-translate` so float height collapses when zoomed out. */
export function sharedPointFloatingBadgeTranslateExpression(maxY: number): unknown[] {
  const expr: unknown[] = ['interpolate', ['exponential', 1.75], ['zoom']];
  for (const [z, t] of SHARED_POINT_FLOATING_BADGE_FLOAT_Y_ZOOM_STOPS) {
    expr.push(z, ['literal', [0, maxY * t]]);
  }
  return expr;
}

/** Zoom-interpolated shadow cast offset. */
export function sharedPointFloatingBadgeShadowTranslateExpression(
  maxTranslate: [number, number] = SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE
): unknown[] {
  const expr: unknown[] = ['interpolate', ['exponential', 1.75], ['zoom']];
  for (const [z, t] of SHARED_POINT_FLOATING_BADGE_SHADOW_STRENGTH_ZOOM_STOPS) {
    expr.push(z, ['literal', [maxTranslate[0] * t, maxTranslate[1] * t]]);
  }
  return expr;
}

/** Zoom-interpolated shadow opacity (faint far out). */
export function sharedPointFloatingBadgeShadowOpacityExpression(
  maxOpacity = SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY
): unknown[] {
  const expr: unknown[] = ['interpolate', ['exponential', 1.75], ['zoom']];
  for (const [z, t] of SHARED_POINT_FLOATING_BADGE_SHADOW_STRENGTH_ZOOM_STOPS) {
    expr.push(z, maxOpacity * t);
  }
  return expr;
}

/** Zoom-interpolated shadow blur (tight far out). */
export function sharedPointFloatingBadgeShadowBlurExpression(
  maxBlur = SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR
): unknown[] {
  const expr: unknown[] = ['interpolate', ['exponential', 1.75], ['zoom']];
  for (const [z, t] of SHARED_POINT_FLOATING_BADGE_SHADOW_STRENGTH_ZOOM_STOPS) {
    expr.push(z, maxBlur * t);
  }
  return expr;
}

/**
 * Ground-shadow radius = fill radius + zoom-scaled pad.
 * Far out the pad collapses so the shadow stays a tiny contact under the dot.
 */
export function sharedPointFloatingBadgeShadowRadiusExpression(
  pointRadius: unknown[] = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  maxPad = SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD
): unknown[] {
  if (!Array.isArray(pointRadius) || pointRadius[0] !== 'interpolate') {
    return ['+', pointRadius, maxPad];
  }
  const next = [...pointRadius];
  for (let i = 3; i < next.length; i += 2) {
    const z = next[i];
    const r = next[i + 1];
    if (typeof z === 'number' && typeof r === 'number') {
      const pad =
        maxPad *
        sampleSharedPointZoomStopFraction(SHARED_POINT_FLOATING_BADGE_SHADOW_PAD_ZOOM_STOPS, z);
      next[i + 1] = r + pad;
    }
  }
  return next;
}

/** Radius for the active selection badge (same size as idle by default). */
export function sharedPointFloatingBadgeSelectedRadiusExpression(
  pointRadius: unknown[] = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  scale = SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE
): unknown[] {
  if (scale === 1) return pointRadius;
  return scaleInterpolateRadiusStops(pointRadius, scale);
}

function easeOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

export function sharedPointFloatingBadgeSelectionTranslateAt(
  from: [number, number],
  to: [number, number],
  elapsedMs: number,
  durationMs = SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS
): [number, number] {
  if (durationMs <= 0) return to;
  const t = easeOutCubic(elapsedMs / durationMs);
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Mix `from` → `to` by `amount` (0–1). Accepts `#rgb` / `#rrggbb`. */
export function mixHexColors(from: string, to: string, amount: number): string {
  const a = parseHexRgb(from);
  const b = parseHexRgb(to);
  if (!a || !b) return amount < 0.5 ? from : to;
  const t = Math.min(1, Math.max(0, amount));
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(a[0] + (b[0] - a[0]) * t)}${toHex(a[1] + (b[1] - a[1]) * t)}${toHex(
    a[2] + (b[2] - a[2]) * t
  )}`;
}

/** Mix `hex` toward white by `amount` (0–1). Accepts `#rgb` / `#rrggbb`. */
export function lightenHexTowardWhite(hex: string, amount: number): string {
  return mixHexColors(hex, '#ffffff', amount);
}

/** Lerp hover ring color between resting and lit over `durationMs` (linear). */
export function sharedPointFloatingBadgeHoverRingColorAt(
  from: string,
  to: string,
  elapsedMs: number,
  durationMs = SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS
): string {
  if (durationMs <= 0) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  return mixHexColors(from, to, t);
}

export type AnnotateFloatingBadgeHoverOptions = {
  fallbackColor: string;
  colorProperty?: string;
  hoverProperty?: string;
  softProperty?: string;
  amount?: number;
  softAmount?: number;
};

/** Soft fill/outer tint from key color (unselected badges). */
export function sharedPointFloatingBadgeSoftColor(
  keyColor: string,
  amount = SHARED_POINT_FLOATING_BADGE_SOFT_LIGHTEN
): string {
  return lightenHexTowardWhite(keyColor, amount);
}

/** Adds `_colorHover` + `_colorSoft` for floating-badge hover / unselected fill paint. */
export function annotatePointFeaturesFloatingBadgeHover(
  collection: FeatureCollection<Point>,
  options: AnnotateFloatingBadgeHoverOptions
): FeatureCollection<Point> {
  const {
    fallbackColor,
    colorProperty = '_color',
    hoverProperty = '_colorHover',
    softProperty = SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
    amount = SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
    softAmount = SHARED_POINT_FLOATING_BADGE_SOFT_LIGHTEN,
  } = options;
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const props = feature.properties ?? {};
      const raw = props[colorProperty];
      const fill =
        typeof raw === 'string' && raw.trim() ? raw.trim() : fallbackColor;
      return {
        ...feature,
        properties: {
          ...props,
          // Bake fallback into `_color` so selection/hover lookups never lose the ring hue.
          [colorProperty]: fill,
          [softProperty]: sharedPointFloatingBadgeSoftColor(fill, softAmount),
          [hoverProperty]: lightenHexTowardWhite(fill, amount),
        },
      };
    }),
  };
}

/** Design-token values for floating-badge look (from `--gk-badge-*`). */
export type SharedPointFloatingBadgeTokens = {
  fill: string;
  outerStrokeColor: string;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowRadiusPad: number;
  coloredRingWidth: number;
  outerStrokeWidth: number;
  glassOpacity: number;
  glassBlur: number;
  glassPad: number;
  strokeOpacity: number;
  outerStrokeOpacity: number;
  hoverLighten: number;
  hoverOuterStrokeWidth: number;
  hoverShadowScale: number;
  selectedShadowScale: number;
  selectedShadowOpacity: number;
  floatTranslate: [number, number];
  hoverTranslate: [number, number];
  selectedTranslate: [number, number];
  selectAnimationMs: number;
  hoverAnimationMs: number;
};

function defaultThemeElement(): Element | null {
  return typeof document !== 'undefined' ? document.documentElement : null;
}

/** Read `--gk-badge-*` design tokens (fallback to shared-point constants). */
export function resolveSharedPointFloatingBadgeTokens(
  element: Element | null = defaultThemeElement()
): SharedPointFloatingBadgeTokens {
  return {
    fill: getCSSVariable(element, '--gk-badge-fill', SHARED_POINT_FLOATING_BADGE_FILL),
    outerStrokeColor: getCSSVariable(
      element,
      '--gk-badge-outer-stroke',
      SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR
    ),
    shadowColor: getCSSVariable(
      element,
      '--gk-badge-shadow',
      SHARED_POINT_FLOATING_BADGE_SHADOW_COLOR
    ),
    shadowOpacity: getCSSVariableNumber(
      element,
      '--gk-badge-shadow-opacity',
      SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY
    ),
    shadowBlur: getCSSVariableNumber(
      element,
      '--gk-badge-shadow-blur',
      SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR
    ),
    shadowRadiusPad: getCSSVariableNumber(
      element,
      '--gk-badge-shadow-pad',
      SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD
    ),
    coloredRingWidth: getCSSVariableNumber(
      element,
      '--gk-badge-ring-width',
      SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH
    ),
    outerStrokeWidth: getCSSVariableNumber(
      element,
      '--gk-badge-outer-stroke-width',
      SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH
    ),
    glassOpacity: getCSSVariableNumber(
      element,
      '--gk-badge-glass-opacity',
      SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY
    ),
    glassBlur: getCSSVariableNumber(
      element,
      '--gk-badge-glass-blur',
      SHARED_POINT_FLOATING_BADGE_GLASS_BLUR
    ),
    glassPad: getCSSVariableNumber(
      element,
      '--gk-badge-glass-pad',
      SHARED_POINT_FLOATING_BADGE_GLASS_PAD
    ),
    strokeOpacity: getCSSVariableNumber(
      element,
      '--gk-badge-stroke-opacity',
      SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY
    ),
    outerStrokeOpacity: getCSSVariableNumber(
      element,
      '--gk-badge-outer-stroke-opacity',
      SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY
    ),
    hoverLighten: getCSSVariableNumber(
      element,
      '--gk-badge-hover-lighten',
      SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN
    ),
    hoverOuterStrokeWidth: getCSSVariableNumber(
      element,
      '--gk-badge-hover-outer-stroke-width',
      SHARED_POINT_FLOATING_BADGE_HOVER_OUTER_STROKE_WIDTH
    ),
    hoverShadowScale: getCSSVariableNumber(
      element,
      '--gk-badge-hover-shadow-scale',
      SHARED_POINT_FLOATING_BADGE_HOVER_SHADOW_SCALE
    ),
    selectedShadowScale: getCSSVariableNumber(
      element,
      '--gk-badge-selected-shadow-scale',
      SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_SCALE
    ),
    selectedShadowOpacity: getCSSVariableNumber(
      element,
      '--gk-badge-selected-shadow-opacity',
      SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_OPACITY
    ),
    floatTranslate: [
      0,
      getCSSVariableNumber(
        element,
        '--gk-badge-float-y',
        SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1]
      ),
    ],
    hoverTranslate: [
      0,
      getCSSVariableNumber(
        element,
        '--gk-badge-hover-float-y',
        SHARED_POINT_FLOATING_BADGE_HOVER_TRANSLATE[1]
      ),
    ],
    selectedTranslate: [
      0,
      getCSSVariableNumber(
        element,
        '--gk-badge-selected-y',
        SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1]
      ),
    ],
    selectAnimationMs: getCSSVariableNumber(
      element,
      '--gk-badge-select-ms',
      SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS
    ),
    hoverAnimationMs: getCSSVariableNumber(
      element,
      '--gk-badge-hover-ms',
      SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS
    ),
  };
}

export type SharedPointFloatingBadgePaintOptions = {
  /** Fallback ring color when feature `_color` (or `colorProperty`) is missing. */
  fallbackColor: string;
  colorProperty?: string;
  /** Element that carries `--gk-badge-*` tokens (defaults to `document.documentElement`). */
  themeElement?: Element | null;
};

/**
 * Reusable floating-badge paint (ground shadow respects map pitch/perspective).
 * Look knobs come from `--gk-badge-*` design tokens; selection still uses JS settle.
 * Pass into `createSharedPointLayersFromPaint` / orchestrator `getPaintConfig`.
 */
export function sharedPointFloatingBadgePaintExpressions(
  options: SharedPointFloatingBadgePaintOptions
) {
  const colorProperty = options.colorProperty ?? '_color';
  const softProperty = SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY;
  const ringColor = ['coalesce', ['get', colorProperty], options.fallbackColor];
  const softFallback = sharedPointFloatingBadgeSoftColor(options.fallbackColor);
  const softFill = ['coalesce', ['get', softProperty], softFallback];
  const tokens = resolveSharedPointFloatingBadgeTokens(
    options.themeElement === undefined ? defaultThemeElement() : options.themeElement
  );
  const restingShadow = sharedPointFloatingBadgeShadowRadiusExpression(
    SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
    tokens.shadowRadiusPad
  );
  const floatTranslate = sharedPointFloatingBadgeTranslateExpression(tokens.floatTranslate[1]);
  const selectedTranslate = sharedPointFloatingBadgeTranslateExpression(
    tokens.selectedTranslate[1]
  );
  const shadowTranslate = sharedPointFloatingBadgeShadowTranslateExpression(
    SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE
  );
  // MapLibre rejects `case` branches that are interpolate arrays for circle-radius —
  // keep resting shadow as a plain interpolate; selected uses selection-source shadow.
  return {
    // Unselected: soft fill + key ring; white outer + drop shadow on every badge.
    pointColorExpression: softFill as unknown[],
    pointRadiusExpression: SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
    // Plain string — some providers mishandle `['literal', '#000']` for circle-color.
    glowColorExpression: tokens.shadowColor,
    glowOpacity: sharedPointFloatingBadgeShadowOpacityExpression(tokens.shadowOpacity),
    glowBlur: sharedPointFloatingBadgeShadowBlurExpression(tokens.shadowBlur),
    glowRadiusExpression: restingShadow,
    glowTranslate: shadowTranslate,
    glowPitchAlignment: SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT,
    glowPitchScale: SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE,
    pointTranslate: floatTranslate,
    // Hover keeps resting height (lighten only); select still settles toward the shadow.
    hoverTranslate: floatTranslate,
    /** Screen-space float — rest/select translate goes straight up, not map-north. */
    pointTranslateAnchor: 'viewport' as const,
    selectionShadowTranslate: shadowTranslate,
    selectionGroundBadge: true as const,
    selectionGroundBadgeFallbackColor: options.fallbackColor,
    /** Selected: same chrome as resting (white core + key ring); only height/shadow change. */
    selectionFillExpression: tokens.fill,
    selectionStrokeColorExpression: ringColor as unknown[],
    selectionOuterStrokeColorExpression: tokens.outerStrokeColor,
    selectedShadowScale: tokens.selectedShadowScale,
    selectedShadowOpacity: tokens.selectedShadowOpacity,
    /** Skip default glow *expand* hover — floating badge lifts via JS; select uses selection shadow. */
    skipFeatureStateHoverGlow: true as const,
    strokeWidthExpression: sharedPointFloatingBadgeRingWidthExpression(
      tokens.coloredRingWidth
    ) as unknown[],
    strokeColorExpression: ringColor as unknown[],
    strokeOpacity: tokens.strokeOpacity,
    outerStrokeWidthExpression: sharedPointFloatingBadgeOuterStrokeWidthExpression(
      tokens.outerStrokeWidth
    ) as unknown[],
    // Always white — soft tint outer vanished on green/light basemaps.
    outerStrokeColorExpression: tokens.outerStrokeColor,
    outerStrokeOpacity: tokens.outerStrokeOpacity,
    glassColorExpression: softFill as unknown[],
    glassOpacity: tokens.glassOpacity,
    glassBlur: tokens.glassBlur,
    glassRadiusExpression: sharedPointFloatingBadgeGlassRadiusExpression(
      SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
      sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth),
      sharedPointFloatingBadgeOuterStrokeWidthExpression(tokens.outerStrokeWidth),
      sharedPointFloatingBadgeGlassPadExpression(tokens.glassPad)
    ),
    paintRevision: SHARED_POINT_FLOATING_BADGE_PAINT_REVISION,
    selectAnimationMs: tokens.selectAnimationMs,
    hoverAnimationMs: tokens.hoverAnimationMs,
    selectedTranslate,
  };
}

/** Glass pad — almost none when zoomed out so continental views stay tidy. */
export function sharedPointFloatingBadgeGlassPadExpression(
  maxPad = SHARED_POINT_FLOATING_BADGE_GLASS_PAD
): unknown[] {
  return [
    'interpolate',
    ['exponential', 1.75],
    ['zoom'],
    0,
    Math.max(0.5, maxPad * 0.2),
    6,
    Math.max(0.75, maxPad * 0.3),
    10,
    maxPad * 0.55,
    14,
    maxPad * 0.9,
    18,
    maxPad,
  ];
}

/** Soft blurred disc behind the unselected badge (past outer stroke). */
export function sharedPointFloatingBadgeGlassRadiusExpression(
  pointRadius: unknown[] = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  coloredRingWidth:
    | number
    | unknown[] = SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH,
  outerStrokeWidth:
    | number
    | unknown[] = SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH,
  glassPad: number | unknown[] = SHARED_POINT_FLOATING_BADGE_GLASS_PAD
): unknown[] {
  const withRing = sharedPointRadiusPlusStrokeWidth(pointRadius, coloredRingWidth);
  const withOuter = sharedPointRadiusPlusStrokeWidth(withRing, outerStrokeWidth);
  return sharedPointRadiusPlusStrokeWidth(withOuter, glassPad) as unknown[];
}

export interface SharedPointFeatureStateHoverOptions {
  glowRadius: unknown[] | number;
  glowOpacity: number | unknown[];
  pointOpacity: number | unknown[];
  glowHoverOpacity: number;
}

export interface SharedPointFeatureStateHoverPaint {
  glowRadius: unknown[] | number;
  glowOpacity: unknown[];
  pointOpacity: unknown[];
}

/** Build MapLibre paint values for shared point feature-state hover. */
export function buildSharedPointFeatureStateHoverPaint(
  options: SharedPointFeatureStateHoverOptions
): SharedPointFeatureStateHoverPaint {
  const { glowRadius, glowOpacity, pointOpacity, glowHoverOpacity } = options;
  const pointOpacityPaint =
    typeof pointOpacity === 'number'
      ? buildOpacityWithHoverExpression(pointOpacity, HOVER_CONFIG.pointOpacity)
      : pointOpacity;
  const glowOpacityPaint =
    typeof glowOpacity === 'number'
      ? buildOpacityWithHoverExpression(glowOpacity, glowHoverOpacity)
      : glowOpacity;

  return {
    glowRadius: scaleRadiusForHover(glowRadius),
    glowOpacity: glowOpacityPaint,
    pointOpacity: pointOpacityPaint,
  };
}

export interface ApplySharedPointPaintOptions {
  ids: SharedPointLayerIds;
  pointColorExpression: unknown[];
  pointRadiusExpression: unknown[];
  glowColorExpression?: string | unknown[];
  glowOpacity?: number | unknown[];
  primarySortProperty?: string;
  primarySortValue?: string;
  strokeWidthExpression?: unknown[];
  strokeColorExpression?: unknown[];
  /** Outer stroke outside the colored ring (e.g. white halo). */
  outerStrokeWidthExpression?: unknown[];
  outerStrokeColorExpression?: unknown[];
  /** Unselected key-ring / outer-stroke opacity (selected stays fully opaque). */
  strokeOpacity?: number;
  outerStrokeOpacity?: number;
  /** Soft frosted disc behind unselected badges. */
  glassColorExpression?: unknown[];
  glassOpacity?: number;
  glassBlur?: number;
  glassRadiusExpression?: unknown[];
  /**
   * Glow/shadow radius. When set, overrides the default hit-area-scaled glow radius
   * (use for tight drop shadows under badges).
   */
  glowRadiusExpression?: unknown[];
  /**
   * Glow/shadow offset in px `[x, y]` (MapLibre: negatives = left/up).
   * Use `[0, 0]` to keep the shadow on the geographic spot.
   * May be a zoom interpolate of `['literal', [x, y]]`.
   */
  glowTranslate?: [number, number] | unknown[];
  /**
   * Ground-shadow pitch alignment. `'map'` foreshortens with camera pitch.
   */
  glowPitchAlignment?: 'map' | 'viewport';
  /**
   * Ground-shadow pitch scale. `'map'` scales with perspective distance.
   */
  glowPitchScale?: 'map' | 'viewport';
  /**
   * Point/badge offset in px `[x, y]` (MapLibre: negatives = left/up).
   * e.g. `[0, -5]` floats the badge above a ground shadow at the map spot.
   * May be a zoom interpolate of `['literal', [x, y]]`.
   */
  pointTranslate?: [number, number] | unknown[];
  /** Hover float translate (slightly higher than `pointTranslate`). Applied via JS on hover. */
  hoverTranslate?: [number, number] | unknown[];
  /** Selected badge settle translate (zoom expression or `[x, y]`). */
  selectedTranslate?: [number, number] | unknown[];
  /** `circle-translate-anchor` for badge layers (`viewport` = straight up on screen). */
  pointTranslateAnchor?: 'map' | 'viewport';
  /** Optional point opacity (e.g. hide when feature-state selected). */
  pointOpacityExpression?: number | unknown[];
  /** Selection ground-shadow offset (defaults in layer create). */
  selectionShadowTranslate?: [number, number] | unknown[];
  /** Selected ground-shadow radius scale (selection-source shadow layer). */
  selectedShadowScale?: number;
  /** Selected ground-shadow opacity (selection-source shadow layer). */
  selectedShadowOpacity?: number;
  /**
   * When true, selection source draws an enlarged grounded badge (floating-badge style).
   * Pair with feature-state `selected` opacity hide on the floating layers.
   */
  selectionGroundBadge?: boolean;
  /** Fallback ring color for the grounded selection badge (locker / theme color). */
  selectionGroundBadgeFallbackColor?: string;
  /** Selected badge fill (white core). */
  selectionFillExpression?: unknown[];
  /** Selected badge ring stroke (key / locker color). */
  selectionStrokeColorExpression?: string | unknown[];
  /** Selected badge outer stroke (white chrome). */
  selectionOuterStrokeColorExpression?: string | unknown[];
  /**
   * When true, do not scale/boost glow on hover (floating-badge ground shadow stays put).
   * Ring/outer stroke still use feature-state hover expressions from paint.
   */
  skipFeatureStateHoverGlow?: boolean;
  /** When set, glow/point layers use feature-state hover paint expressions. */
  featureStateHover?: SharedPointFeatureStateHoverOptions;
  /** Monotonic look revision — apps include this in paint fingerprints. */
  paintRevision?: number;
  /** Shadow blur — number or zoom interpolate. */
  glowBlur?: number | unknown[];
  selectAnimationMs?: number;
  hoverAnimationMs?: number;
}

/** Apply paint/layout overrides to an existing shared point layer set. */
export function applySharedPointLayerPaint(
  map: MapInstance,
  options: ApplySharedPointPaintOptions
): void {
  const {
    ids: { glowLayerId, pointLayerId },
    pointColorExpression,
    pointRadiusExpression,
    glowColorExpression,
    glowOpacity = SHARED_POINT_UNIFORM_GLOW_OPACITY,
    primarySortProperty,
    primarySortValue,
    strokeWidthExpression = sharedPointStrokeWidthExpression(),
    strokeColorExpression = sharedPointStrokeColorExpression(),
    outerStrokeWidthExpression,
    outerStrokeColorExpression,
    strokeOpacity,
    outerStrokeOpacity,
    glassColorExpression,
    glassOpacity,
    glassBlur,
    glassRadiusExpression,
    glowRadiusExpression,
    glowTranslate,
    glowPitchAlignment,
    glowPitchScale,
    pointTranslate,
    pointTranslateAnchor,
    pointOpacityExpression,
    selectionGroundBadge,
    skipFeatureStateHoverGlow,
    featureStateHover,
    glowBlur,
  } = options;

  const glowColor = glowColorExpression ?? paintColorFromProperty();
  const hoverPaint =
    featureStateHover && !skipFeatureStateHoverGlow && !selectionGroundBadge
      ? buildSharedPointFeatureStateHoverPaint(featureStateHover)
      : null;

  if (map.getLayer?.(glowLayerId)) {
    map.setPaintProperty?.(glowLayerId, 'circle-color', glowColor);
    if (glowRadiusExpression != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-radius', glowRadiusExpression);
    } else if (hoverPaint) {
      map.setPaintProperty?.(glowLayerId, 'circle-radius', hoverPaint.glowRadius);
    } else {
      map.setPaintProperty?.(
        glowLayerId,
        'circle-radius',
        sharedPointGlowRadiusFromPointExpression(pointRadiusExpression)
      );
    }
    if (Array.isArray(glowOpacity) || pointOpacityExpression != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', glowOpacity);
    } else if (hoverPaint) {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', hoverPaint.glowOpacity);
    } else {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', glowOpacity);
    }
    if (glowBlur != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-blur', glowBlur);
    }
    if (glowTranslate != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-translate', glowTranslate);
    }
    if (glowPitchAlignment != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-pitch-alignment', glowPitchAlignment);
    }
    if (glowPitchScale != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-pitch-scale', glowPitchScale);
    }
  }

  if (map.getLayer?.(pointLayerId)) {
    map.setPaintProperty?.(pointLayerId, 'circle-color', pointColorExpression);
    map.setPaintProperty?.(pointLayerId, 'circle-radius', pointRadiusExpression);
    if (pointOpacityExpression != null) {
      map.setPaintProperty?.(pointLayerId, 'circle-opacity', pointOpacityExpression);
    } else if (hoverPaint) {
      map.setPaintProperty?.(pointLayerId, 'circle-opacity', hoverPaint.pointOpacity);
    }
    map.setPaintProperty?.(pointLayerId, 'circle-stroke-width', strokeWidthExpression);
    map.setPaintProperty?.(pointLayerId, 'circle-stroke-color', strokeColorExpression);
    if (strokeOpacity != null) {
      map.setPaintProperty?.(pointLayerId, 'circle-stroke-opacity', strokeOpacity);
    }
    if (pointTranslate != null) {
      map.setPaintProperty?.(pointLayerId, 'circle-translate', pointTranslate);
    }
    if (pointTranslateAnchor != null) {
      map.setPaintProperty?.(pointLayerId, 'circle-translate-anchor', pointTranslateAnchor);
    }

    if (primarySortProperty && primarySortValue && map.setLayoutProperty) {
      try {
        map.setLayoutProperty(
          pointLayerId,
          'circle-sort-key',
          circleSortKeyByProperty(primarySortProperty, primarySortValue)
        );
      } catch {
        // Ignore if provider/style doesn't support circle-sort-key.
      }
    }
  }

  const outerStrokeLayerId = sharedPointOuterStrokeLayerId(pointLayerId);
  if (map.getLayer?.(outerStrokeLayerId) && outerStrokeWidthExpression != null) {
    const coloredRingWidth = literalNumberFromPaintExpression(strokeWidthExpression);
    // Prefer the zoom expression — literalNumber is 0 for interpolates and collapses the halo.
    map.setPaintProperty?.(
      outerStrokeLayerId,
      'circle-radius',
      Array.isArray(strokeWidthExpression)
        ? sharedPointRadiusPlusStrokeWidth(pointRadiusExpression, strokeWidthExpression)
        : sharedPointRadiusPlusStrokeWidth(pointRadiusExpression, coloredRingWidth)
    );
    map.setPaintProperty?.(outerStrokeLayerId, 'circle-stroke-width', outerStrokeWidthExpression);
    if (outerStrokeColorExpression != null) {
      map.setPaintProperty?.(
        outerStrokeLayerId,
        'circle-stroke-color',
        outerStrokeColorExpression
      );
    }
    if (outerStrokeOpacity != null) {
      map.setPaintProperty?.(outerStrokeLayerId, 'circle-stroke-opacity', outerStrokeOpacity);
    }
    if (pointTranslate != null) {
      map.setPaintProperty?.(outerStrokeLayerId, 'circle-translate', pointTranslate);
    }
    if (pointTranslateAnchor != null) {
      map.setPaintProperty?.(
        outerStrokeLayerId,
        'circle-translate-anchor',
        pointTranslateAnchor
      );
    }
    if (pointOpacityExpression != null) {
      map.setPaintProperty?.(outerStrokeLayerId, 'circle-opacity', pointOpacityExpression);
    }
  }

  const glassLayerId = sharedPointGlassLayerId(pointLayerId);
  if (map.getLayer?.(glassLayerId) && glassRadiusExpression != null) {
    map.setPaintProperty?.(glassLayerId, 'circle-radius', glassRadiusExpression);
    if (glassColorExpression != null) {
      map.setPaintProperty?.(glassLayerId, 'circle-color', glassColorExpression);
    }
    if (glassOpacity != null) {
      map.setPaintProperty?.(glassLayerId, 'circle-opacity', glassOpacity);
    }
    if (glassBlur != null) {
      map.setPaintProperty?.(glassLayerId, 'circle-blur', glassBlur);
    }
    if (pointTranslate != null) {
      map.setPaintProperty?.(glassLayerId, 'circle-translate', pointTranslate);
    }
    if (pointTranslateAnchor != null) {
      map.setPaintProperty?.(glassLayerId, 'circle-translate-anchor', pointTranslateAnchor);
    }
  }

  // Grounded selection chrome stays on the map spot (do not inherit float translate).
  const selectionRingLayerId = `${pointLayerId}-selection-ring`;
  if (map.getLayer?.(selectionRingLayerId) && pointTranslate != null && !selectionGroundBadge) {
    map.setPaintProperty?.(selectionRingLayerId, 'circle-translate', pointTranslate);
    if (pointTranslateAnchor != null) {
      map.setPaintProperty?.(selectionRingLayerId, 'circle-translate-anchor', pointTranslateAnchor);
    }
  }

  const selectionBadgeLayerId = `${pointLayerId}-selection-badge`;
  const selectionBadgeOuterLayerId = `${pointLayerId}-selection-badge-outer`;
  if (pointTranslateAnchor != null) {
    if (map.getLayer?.(selectionBadgeLayerId)) {
      map.setPaintProperty?.(
        selectionBadgeLayerId,
        'circle-translate-anchor',
        pointTranslateAnchor
      );
    }
    if (map.getLayer?.(selectionBadgeOuterLayerId)) {
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-translate-anchor',
        pointTranslateAnchor
      );
    }
  }
  if (map.getLayer?.(selectionBadgeLayerId) && selectionGroundBadge) {
    const fallback =
      options.selectionGroundBadgeFallbackColor?.trim() ||
      (Array.isArray(strokeColorExpression) &&
      strokeColorExpression[0] === 'coalesce' &&
      typeof strokeColorExpression[strokeColorExpression.length - 1] === 'string'
        ? (strokeColorExpression[strokeColorExpression.length - 1] as string)
        : '#888888');
    // White core + key ring (same as resting). Never paint fill as `_color` (solid disc).
    const selectedFill =
      options.selectionFillExpression ?? SHARED_POINT_FLOATING_BADGE_FILL;
    const selectedStroke =
      options.selectionStrokeColorExpression ??
      ([
        'coalesce',
        ['get', '_color'],
        ['get', 'color'],
        ['get', 'marker-color'],
        fallback,
      ] as unknown[]);
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-color', selectedFill);
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-stroke-color', selectedStroke);
    // Keep selected badge on the same zoom-scaled size curve as resting dots.
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-radius', pointRadiusExpression);
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-stroke-width', strokeWidthExpression);
    if (map.getLayer?.(selectionBadgeOuterLayerId) && outerStrokeWidthExpression != null) {
      const coloredRingWidth = literalNumberFromPaintExpression(strokeWidthExpression);
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-radius',
        Array.isArray(strokeWidthExpression)
          ? sharedPointRadiusPlusStrokeWidth(pointRadiusExpression, strokeWidthExpression)
          : sharedPointRadiusPlusStrokeWidth(pointRadiusExpression, coloredRingWidth)
      );
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-stroke-width',
        outerStrokeWidthExpression
      );
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-stroke-color',
        options.selectionOuterStrokeColorExpression ?? SHARED_POINT_FLOATING_BADGE_FILL
      );
    }
  }

  const hoverGlowLayerId = `${glowLayerId}-hover`;
  if (map.getLayer?.(hoverGlowLayerId)) {
    map.setPaintProperty?.(
      hoverGlowLayerId,
      'circle-radius',
      SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION
    );
  }
}

/**
 * Attach a styledata listener until hover glow radius is applied (layer may appear async).
 * Returns cleanup to remove the listener.
 */
export function attachSharedPointHoverGlowRadiusSync(
  map: MapInstance,
  glowLayerId: string
): () => void {
  const hoverGlowLayerId = `${glowLayerId}-hover`;
  let applied = false;

  const onStyleData = () => {
    if (applied) return;
    if (!map.getLayer?.(hoverGlowLayerId)) return;
    try {
      map.setPaintProperty?.(
        hoverGlowLayerId,
        'circle-radius',
        SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION
      );
      applied = true;
      map.off?.('styledata', onStyleData);
    } catch {
      // Layer might not be ready yet.
    }
  };

  map.on?.('styledata', onStyleData);
  onStyleData();

  return () => {
    map.off?.('styledata', onStyleData);
  };
}
