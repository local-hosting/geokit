/**
 * MapLibre paint/layout expressions for shared point layers.
 *
 * Prefer pre-computing colors on feature properties (_color) and using simple
 * coalesce/get expressions — complex data-driven paint causes MapTiler to drop
 * features at low zoom when per-tile rendering budgets are exceeded.
 */

import type { FeatureCollection, Point } from 'geojson';
import {
  brightenHex,
  darkenHexTowardBlack,
  easeOutCubic,
  intensifyHex,
  lightenHexTowardWhite,
  mixHexColors,
} from '@local-hosting/geokit/core';
import type { MapInstance } from '../../providers/types';
import {
  sharedPointCircleBodyFilter,
  sharedPointCombineLayerFilters,
  sharedPointRoundedRectBodyFilter,
} from '../markers/marker-shape';
import {
  buildOpacityWithHoverExpression,
  HOVER_CONFIG,
  scaleRadiusForHover,
} from '../map-surface/feature-state-hover';
import { getCSSVariable, getCSSVariableNumber } from '../map-surface/theme';

/** Min point radius (px). Safari needs ≥2px or circles can vanish when zoomed out. */
export const SHARED_POINT_MIN_RADIUS_PX = 2.8;

/**
 * At or below this zoom, floating badges render as shining dots (solid key color on a
 * glow) — the white core and rims swamp tiny dots on regional/continental views.
 */
export const SHARED_POINT_ZOOMED_OUT_MAX_ZOOM = 9;

/** Selected dot is slightly larger than resting dots when zoomed out. */
/** Keep selected dot the same size as resting when zoomed out — no click grow/jump. */
export const SHARED_POINT_ZOOMED_OUT_SELECTED_RADIUS_SCALE = 1;

/** Zoomed-out dot core color (key lightened by `--gk-badge-dot-lighten`). */
export const SHARED_POINT_DOT_COLOR_PROPERTY = '_colorDot';

/** Zoomed-out core: annotated bright dot color, else the key ring color. */
export function sharedPointDotColorExpression(keyColor: unknown): unknown[] {
  return ['coalesce', ['get', SHARED_POINT_DOT_COLOR_PROPERTY], keyColor];
}

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
export const SHARED_POINT_FLOATING_BADGE_PAINT_REVISION = 69;

/**
 * Badge core radius by zoom — linear + dense stops so size grows evenly while zooming
 * (no late exponential spike at street scale). Regional + city views stay pin-sized.
 */
export const SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION: unknown[] = [
  'interpolate',
  ['linear'],
  ['zoom'],
  0,
  1,
  4,
  1.15,
  6,
  1.35,
  8,
  1.65,
  10,
  2.2,
  11,
  2.6,
  12,
  3.1,
  13,
  3.6,
  14,
  4.4,
  15,
  5.5,
  16,
  7,
  17,
  8.5,
  18,
  10.5,
];

/** Colored ring width — none when zoomed out (shining dots); readable key band from city scale in. */
export function sharedPointFloatingBadgeRingWidthExpression(
  maxWidth = SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH
): unknown[] {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    0,
    SHARED_POINT_ZOOMED_OUT_MAX_ZOOM,
    0,
    10,
    maxWidth * 0.35,
    12,
    maxWidth * 0.48,
    14,
    maxWidth * 0.58,
    16,
    maxWidth * 0.7,
    18,
    maxWidth * 0.85,
  ];
}

/**
 * Outer stroke width by zoom. Resting uses darker-key width; selection may pass a
 * wider selected token (white outer on the selection stack).
 */
export function sharedPointFloatingBadgeOuterStrokeWidthExpression(
  maxWidth = SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH
): number | unknown[] {
  // Numeric 0 — not `['literal', 0]`. Wrapping a zoom interpolate in `+` with a
  // literal breaks Mapbox circle-radius validation (zoom must be top-level only).
  if (maxWidth <= 0) {
    return 0;
  }
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    0,
    0,
    SHARED_POINT_ZOOMED_OUT_MAX_ZOOM,
    0,
    10,
    maxWidth * 0.4,
    12,
    maxWidth * 0.55,
    14,
    maxWidth * 0.7,
    16,
    maxWidth * 0.9,
    18,
    maxWidth * 1.25,
  ];
}

/** Zoom step: `zoomedOut` at/below {@link SHARED_POINT_ZOOMED_OUT_MAX_ZOOM}, else `zoomedIn`. */
export function sharedPointZoomedOutStep(zoomedOut: unknown, zoomedIn: unknown): unknown[] {
  return ['step', ['zoom'], zoomedOut, SHARED_POINT_ZOOMED_OUT_MAX_ZOOM + 1, zoomedIn];
}

/**
 * Glass layer paint: frosted soft disc behind circle badges zoomed in; zoomed out it is
 * the shining-dot glow (key color, {@link SHARED_POINT_DEFAULT_GLOW_OPACITY}) behind every
 * shape, matching the standard filled-dot + glow maps.
 */
export function sharedPointGlassPaint(options: {
  glassRadius: unknown;
  glassColor: unknown;
  glowColor: unknown;
  pointRadius: unknown;
  ringWidth: number | unknown[];
  glassOpacity?: number;
  glassBlur?: number;
}): Record<string, unknown> {
  const glassOpacity = options.glassOpacity ?? SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY;
  const isSelected = ['boolean', ['feature-state', 'selected'], false];
  const isHovered = ['boolean', ['feature-state', 'hover'], false];
  // Zoomed out the glow stays behind the selected dot (brighter, like hover).
  const glowOpacity = [
    'case',
    ['any', isSelected, isHovered],
    SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
    SHARED_POINT_DEFAULT_GLOW_OPACITY,
  ];
  const frostedOpacity = [
    'case',
    ['any', isSelected, sharedPointRoundedRectBodyFilter()],
    0,
    glassOpacity,
  ];
  return {
    'circle-radius': sharedPointZoomedOutGlowRadius(
      options.glassRadius,
      sharedPointRadiusPlusStrokeWidth(options.pointRadius, options.ringWidth)
    ),
    'circle-color': sharedPointZoomedOutStep(options.glowColor, options.glassColor),
    'circle-opacity': sharedPointZoomedOutStep(glowOpacity, frostedOpacity),
    'circle-blur': sharedPointZoomedOutStep(
      SHARED_POINT_DEFAULT_GLOW_BLUR,
      options.glassBlur ?? SHARED_POINT_FLOATING_BADGE_GLASS_BLUR
    ),
  };
}

/** Glass radius with zoomed-out stops replaced by the glow halo (dot × hit-area scale). */
function sharedPointZoomedOutGlowRadius(glassRadius: unknown, dotRadius: unknown): unknown {
  if (!isZoomInterpolateExpression(glassRadius) || !isZoomInterpolateExpression(dotRadius)) {
    return glassRadius;
  }
  const [op, curve, input, ...stops] = glassRadius;
  const glowAt = (zoom: number) =>
    sampleZoomInterpolateValue(dotRadius, zoom) * SHARED_POINT_GLOW_HIT_AREA_SCALE;
  const merged: unknown[] = [];
  for (let i = 0; i < stops.length; i += 2) {
    const zoom = stops[i] as number;
    if (zoom < SHARED_POINT_ZOOMED_OUT_MAX_ZOOM) merged.push(zoom, glowAt(zoom));
  }
  merged.push(SHARED_POINT_ZOOMED_OUT_MAX_ZOOM, glowAt(SHARED_POINT_ZOOMED_OUT_MAX_ZOOM));
  for (let i = 0; i < stops.length; i += 2) {
    if ((stops[i] as number) > SHARED_POINT_ZOOMED_OUT_MAX_ZOOM) merged.push(stops[i], stops[i + 1]);
  }
  return [op, curve, input, ...merged];
}

/**
 * Selected badge middle ring: white zoomed in; key color zoomed out so the dot stays solid
 * and the separate selection ring (white, with a gap) marks it.
 */
export function sharedPointSelectedMiddleRingColor(
  accentColor: unknown,
  white: unknown = SHARED_POINT_FLOATING_BADGE_FILL
): unknown[] {
  return sharedPointZoomedOutStep(accentColor, white);
}

/** Resting glyph tint — hidden when zoomed out, where it reads as a white speck. */
export function sharedPointRestingGlyphColor(glyphColor: string): unknown[] {
  return sharedPointZoomedOutStep('rgba(0,0,0,0)', glyphColor);
}

/** Resting outer-stroke width with the white rim removed when zoomed out. */
export function sharedPointRestingOuterStrokeWidth(
  width: number | unknown[],
  minZoom = SHARED_POINT_ZOOMED_OUT_MAX_ZOOM
): unknown[] {
  if (!Array.isArray(width)) {
    return ['step', ['zoom'], 0, minZoom + 1, width];
  }
  const [op, curve, input, ...stops] = width;
  const isZoomInterpolate =
    op === 'interpolate' && Array.isArray(input) && input[0] === 'zoom';
  if (!isZoomInterpolate) return width;
  const kept: unknown[] = [];
  for (let i = 0; i < stops.length; i += 2) {
    if ((stops[i] as number) > minZoom) kept.push(stops[i], stops[i + 1]);
  }
  return [op, curve, input, minZoom, 0, ...kept];
}

export const SHARED_POINT_FLOATING_BADGE_FILL = '#ffffff';
/** Neutral key when neither the feature nor the app supplies a color. */
export const SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR = '#888888';
/** HSV brighten (0–1) of the key color for the frosted glass disc. */
export const SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN = 0.55;
export const SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY = '_colorSoft';
/** Unselected key color — HSV brighten (0–1) so the hue stays saturated, not washed white. */
export const SHARED_POINT_FLOATING_BADGE_RESTING_BRIGHTEN = 0.3;
/** Unselected key color — HSV saturation boost (0–1) for a more intense hue. */
export const SHARED_POINT_FLOATING_BADGE_RESTING_SATURATE = 0.45;
/** Raw locker/brand key before resting brighten — re-annotation reads this first. */
export const SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY = '_colorKey';
/** Frosted disc behind unselected badges (MapLibre blur stand-in for glass). */
export const SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY = 0.38;
export const SHARED_POINT_FLOATING_BADGE_GLASS_BLUR = 0.65;
/** Tight frost bloom — must stay smaller than the ground shadow after float. */
export const SHARED_POINT_FLOATING_BADGE_GLASS_PAD = 1.5;
export const SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH = 9;
/** Outer band peeks from under core+ring — resting uses darker key; selected gets white. */
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH = 2.5;
export const SHARED_POINT_FLOATING_BADGE_SELECTED_OUTER_STROKE_WIDTH = 3;
/** Unselected light outer (and CSS `--gk-badge-outer-stroke` default). */
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR = '#ffffff';
/** Mix key toward black for the selected outer rim (0–1). */
export const SHARED_POINT_FLOATING_BADGE_OUTER_DARKEN = 0.28;
export const SHARED_POINT_FLOATING_BADGE_OUTER_COLOR_PROPERTY = '_colorOuter';
/** Unselected key ring — opaque so the basemap doesn't wash out the brightened key. */
export const SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY = 1;
/** Resting outer rim opacity. */
export const SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY = 0.95;
export const SHARED_POINT_FLOATING_BADGE_SHADOW_COLOR = '#000000';
/** Resting ground wash — slightly quieter than selected. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY = 0.14;
/** Soft edge so the shadow reads as diffuse contact, not a sharp ellipse. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR = 0.8;
/**
 * Pad past the full badge (fill + ring + outer band) — the cast offset does the peeking.
 * Zoom stops keep continental pads tiny (no fat black disks).
 */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD = 2;
/** Screen-space drop: slight SE cast (one light source from the NW). */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE: [number, number] = [3, 7];
/** Resting viewport lift — unselected badges stay grounded (deep zoom max). */
export const SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE: [number, number] = [0, 0];
/** Active/selected badge — lifts above the map; shadow stays put (deep zoom max). */
/** Defaults match float height — apps that want settle override `--gk-badge-selected-y`. */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE: [number, number] = [0, 0];
export const SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS = 180;
/** Hover ring color lerp duration (linear — instant start/stop, fluid mid). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS = 120;
/** Mix toward white on hover (0–1) — unused; hover uses key glow layer instead. */
export const SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN = 0;
/** Mix toward black on select (0–1) — 0 keeps the intensified resting hue when selected. */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN = 0;
export const SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY = '_colorSelected';
/** Outer white stroke width on hover — unused (stroke stays put). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_OUTER_STROKE_WIDTH = 9;
/** Hover keeps resting height — lighten only, no raise/lower (deep zoom max). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_TRANSLATE: [number, number] = [0, 0];
/** Scale ground-shadow radius while hovered (< 1). */
export const SHARED_POINT_FLOATING_BADGE_HOVER_SHADOW_SCALE = 0.78;
/** Selected shadow scale — same footprint as resting (no size jump on click). */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_SCALE = 1;
/** Selected ground-shadow — only a touch stronger than resting. */
export const SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_OPACITY = 0.34;
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
/** Viewport-aligned so pitch does not squash or skew the cast under the upright badge. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT = 'viewport' as const;
/** Upright badge disks stay above Mapbox `fill-extrusion` depth (3D buildings). */
export const SHARED_POINT_FLOATING_BADGE_MARKER_PITCH_ALIGNMENT = 'viewport' as const;
export const SHARED_POINT_FLOATING_BADGE_MARKER_PITCH_SCALE = 'viewport' as const;
export const SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE_ANCHOR = 'viewport' as const;
/** Viewport scale keeps every shadow disc round — `map` made casts lean differently across the view. */
export const SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE = 'viewport' as const;
export const SHARED_POINT_FLOATING_BADGE_SELECTION_SHADOW_COLOR = 'rgba(0, 0, 0, 0.32)';
/** Floating-badge select = lifted badge only — no halo (transparent if anything restores stroke). */
export const SHARED_POINT_FLOATING_BADGE_SELECTION_RING_COLOR = 'rgba(0, 0, 0, 0)';
/** Selected badge keeps the same radius as resting (only height changes). */
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

/**
 * Hide the selected feature on the resting stack while the selection source
 * draws the grounded badge (so select can settle without a double marker).
 */
export function syncSharedPointSelectedLayerFilter(
  map: {
    getLayer?(id: string): unknown;
    setFilter?(id: string, filter: unknown[] | null): void;
  },
  options: SyncSharedPointSelectedLayerFilterOptions
): void {
  if (!map.setFilter) return;
  const excludeSelected =
    options.featureId != null && options.featureId !== ''
      ? sharedPointExcludeFeatureIdFilter(options.promoteId, options.featureId)
      : null;
  const circleShape = sharedPointCircleBodyFilter();
  const roundedShape = sharedPointRoundedRectBodyFilter();
  const circleFilter =
    excludeSelected != null
      ? sharedPointCombineLayerFilters(circleShape, excludeSelected)
      : circleShape;
  const roundedFilter =
    excludeSelected != null
      ? sharedPointCombineLayerFilters(roundedShape, excludeSelected)
      : roundedShape;
  const glowLayerId =
    options.glowLayerId ??
    (options.pointLayerId.endsWith('-point')
      ? `${options.pointLayerId.slice(0, -'-point'.length)}-glow`
      : undefined);
  const circleBodyLayerIds = [
    options.pointLayerId,
    sharedPointOuterStrokeLayerId(options.pointLayerId),
    sharedPointGlassLayerId(options.pointLayerId),
  ];

  for (const layerId of circleBodyLayerIds) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setFilter(layerId, circleFilter);
    } catch {
      /* layer may reject filter briefly during style swap */
    }
  }

  // Selected pin uses selection-shadow for its clear under cast — drop resting glow
  // under that feature so the two washes do not stack.
  if (glowLayerId) {
    for (const layerId of [glowLayerId, `${glowLayerId}-hover`]) {
      if (!map.getLayer?.(layerId)) continue;
      try {
        map.setFilter(layerId, excludeSelected);
      } catch {
        /* layer may reject filter briefly during style swap */
      }
    }
  }

  for (const layerId of [
    `${options.pointLayerId}-rounded-outer`,
    `${options.pointLayerId}-rounded-ring`,
    `${options.pointLayerId}-rounded-body`,
    `${options.pointLayerId}-badge-icon`,
    sharedPointHoverBadgeLayerId(options.pointLayerId),
    sharedPointHoverBadgeOuterLayerId(options.pointLayerId),
    `${options.pointLayerId}-hover`,
  ]) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setFilter(layerId, roundedFilter);
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

export function paintColorFromProperty(property = '_color', fallback = SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR): unknown[] {
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
    colorFallback = SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
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

/** Transforms a fill hex into a stroke hex (e.g. host `blendHexWithBlack`). */
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
 * Pass host identity `blendHexWithBlack` (or similar) as `transformFill`.
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
  /** Color transform — typically host identity `blendHexWithBlack`. */
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

import {
  applySharedPointLayersAbove3dExtrusions,
  sharedPointGlassLayerId,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
  sharedPointOuterStrokeLayerId,
  type SharedPointLayerIds,
} from './shared-point/layer-ids';

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
 * Where the outer circle-stroke starts: fill radius + colored ring width.
 * Fill plugs the seam under the ring; stroke draws the smooth visible rim.
 */
export function sharedPointFloatingBadgeOuterStrokeRadius(
  pointRadius: unknown,
  coloredRingWidth: number | unknown[]
): unknown {
  return sharedPointRadiusPlusStrokeWidth(pointRadius, coloredRingWidth);
}

/**
 * Full outer extent (fill + ring + outer band) — glass / shadow sizing.
 */
export function sharedPointFloatingBadgeOuterDiscRadius(
  pointRadius: unknown,
  coloredRingWidth: number | unknown[],
  outerStrokeWidth: number | unknown[]
): unknown {
  const withRing = sharedPointFloatingBadgeOuterStrokeRadius(pointRadius, coloredRingWidth);
  return sharedPointRadiusPlusStrokeWidth(withRing, outerStrokeWidth);
}

/** Unwrap `['literal', n]` / bare numbers so radius math never nests zoom under `+`. */
function unwrapPaintLiteralNumber(expr: unknown): number | undefined {
  if (typeof expr === 'number' && Number.isFinite(expr)) return expr;
  if (Array.isArray(expr) && expr[0] === 'literal' && typeof expr[1] === 'number') {
    return expr[1];
  }
  return undefined;
}

/**
 * Radius after adding a stroke/band width to a fill radius.
 * MapLibre draws circle-stroke outside circle-radius; filled discs use the same sum.
 * `strokeWidth` may be a zoom interpolate (badge stack scales with the map).
 * Never emits `['+', interpolate(zoom), …]` — Mapbox rejects nested zoom in circle-radius.
 */
export function sharedPointRadiusPlusStrokeWidth(
  pointRadius: unknown,
  strokeWidth: number | unknown[]
): unknown {
  const strokeNum = unwrapPaintLiteralNumber(strokeWidth);
  if (strokeNum !== undefined) {
    if (!(strokeNum > 0)) return pointRadius;
    if (typeof pointRadius === 'number') return pointRadius + strokeNum;
    if (isZoomInterpolateExpression(pointRadius)) {
      const result = [...pointRadius];
      for (let i = 4; i < result.length; i += 2) {
        if (typeof result[i] === 'number') {
          result[i] = (result[i] as number) + strokeNum;
        }
      }
      return result;
    }
    if (Array.isArray(pointRadius) && pointRadius[0] === 'literal') {
      return ['+', pointRadius, strokeNum];
    }
    return pointRadius;
  }
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
    // Non-zoom array stroke (unexpected) — prefer the fill radius over nesting zoom.
    return pointRadius;
  }
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

/** Viewport `circle-translate` with x locked to 0 (straight up on screen). */
export function sharedPointFloatingBadgeViewportTranslate(y: number): [number, number] {
  return [0, y];
}

/** True when `circle-translate` is a zoom interpolate expression. */
export function sharedPointFloatingBadgeIsZoomTranslateExpression(
  translate: unknown
): translate is unknown[] {
  return Array.isArray(translate) && translate[0] === 'interpolate';
}

/** Keep numeric lifts on the Y axis; pass zoom expressions through unchanged. */
export function sharedPointFloatingBadgeNormalizeViewportTranslate(
  translate: [number, number] | unknown[]
): [number, number] | unknown[] {
  if (sharedPointFloatingBadgeIsZoomTranslateExpression(translate)) return translate;
  return sharedPointFloatingBadgeViewportTranslate((translate as [number, number])[1]);
}

/** Near-equal screen translates — skip restarting a lift that is already there. */
export function sharedPointFloatingBadgeTranslatesNearlyEqual(
  a: [number, number],
  b: [number, number],
  epsilon = 0.5
): boolean {
  return Math.abs(a[0] - b[0]) < epsilon && Math.abs(a[1] - b[1]) < epsilon;
}

/** Linear lerp between two viewport translates (`t` clamped 0–1). */
export function sharedPointFloatingBadgeLerpTranslate(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  const u = Math.min(1, Math.max(0, t));
  return [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u];
}

/** Viewport translate at a zoom — used by select/hover JS animation. */
export function sharedPointFloatingBadgeTranslateAtZoom(
  maxY: number,
  zoom: number
): [number, number] {
  return sharedPointFloatingBadgeViewportTranslate(
    maxY *
      sampleSharedPointZoomStopFraction(SHARED_POINT_FLOATING_BADGE_FLOAT_Y_ZOOM_STOPS, zoom)
  );
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
  pointRadius: unknown[] = sharedPointFloatingBadgeOuterDiscRadius(
    sharedPointFloatingBadgeRadiusExpression(),
    sharedPointFloatingBadgeRingWidthExpression(),
    sharedPointFloatingBadgeOuterStrokeWidthExpression()
  ) as unknown[],
  maxPad = SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD
): unknown[] {
  // Fold pad into zoom stops — never `['+', interpolate(zoom), pad]` (Mapbox rejects).
  if (!isZoomInterpolateExpression(pointRadius)) {
    const base = unwrapPaintLiteralNumber(pointRadius);
    if (typeof base === 'number') return ['literal', base + maxPad];
    return pointRadius as unknown[];
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
  pointRadius: unknown[] = sharedPointFloatingBadgeRadiusExpression(),
  scale = SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE
): unknown[] {
  const scaled = scale === 1 ? pointRadius : scaleInterpolateRadiusStops(pointRadius, scale);
  if (!isZoomInterpolateExpression(scaled)) return scaled;
  const [op, curve, input, ...stops] = scaled;
  const zoomedOutScaled = stops.map((value, i) =>
    i % 2 === 1 && (stops[i - 1] as number) <= SHARED_POINT_ZOOMED_OUT_MAX_ZOOM
      ? (value as number) * SHARED_POINT_ZOOMED_OUT_SELECTED_RADIUS_SCALE
      : value
  );
  return [op, curve, input, ...zoomedOutScaled];
}

export function sharedPointFloatingBadgeSelectionTranslateAt(
  from: [number, number],
  to: [number, number],
  elapsedMs: number,
  durationMs = SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS
): [number, number] {
  if (durationMs <= 0) return to;
  return sharedPointFloatingBadgeLerpTranslate(
    from,
    to,
    easeOutCubic(elapsedMs / durationMs)
  );
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
  selectedProperty?: string;
  selectedAmount?: number;
  outerProperty?: string;
  outerAmount?: number;
  /** Defaults to `--gk-badge-resting-brighten`. */
  restingBrighten?: number;
  /** Defaults to `--gk-badge-resting-saturate`. */
  restingSaturate?: number;
  /**
   * When true, every feature uses `fallbackColor` as the key (locker identity).
   * Ignores stale per-feature `_color` / `_colorKey` / `_colorResting`.
   */
  forceFallbackKey?: boolean;
  /** When set, stamps `_colorHover` to this hex (app accent) instead of lightening the key. */
  hoverColor?: string;
  /** When set, stamps `_colorSelected` to this hex instead of darkening the key. */
  selectedColor?: string;
};

/** Soft fill/outer tint from key color (unselected badges). */
export function sharedPointFloatingBadgeSoftColor(
  keyColor: string,
  amount = SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN
): string {
  return brightenHex(keyColor, amount);
}

/** Unselected ring / rounded body color from the raw key. */
export function sharedPointFloatingBadgeRestingColor(
  keyColor: string,
  brighten = SHARED_POINT_FLOATING_BADGE_RESTING_BRIGHTEN,
  saturate = SHARED_POINT_FLOATING_BADGE_RESTING_SATURATE
): string {
  return intensifyHex(keyColor, saturate, brighten);
}

/** Dark fill tint from key color (selected badge core). */
export function sharedPointFloatingBadgeSelectedColor(
  keyColor: string,
  amount = SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN
): string {
  return darkenHexTowardBlack(keyColor, amount);
}

/** Selected outer rim — same hue as the key ring, slightly darker. */
export function sharedPointFloatingBadgeOuterColor(
  keyColor: string,
  amount = SHARED_POINT_FLOATING_BADGE_OUTER_DARKEN
): string {
  return darkenHexTowardBlack(keyColor, amount);
}

/**
 * Resting locker/key color for selection (not hover-lit `_color`).
 * Hover may have overwritten `_color` with the lit tint — prefer `_colorResting`.
 */
export function resolveFloatingBadgeSelectionKeyColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string
): string {
  const resting = properties?._colorResting;
  if (typeof resting === 'string' && resting.trim()) return resting.trim();
  const color = typeof properties?._color === 'string' ? properties._color.trim() : '';
  const hover = typeof properties?._colorHover === 'string' ? properties._colorHover.trim() : '';
  const fallback = fallbackColor.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  if (color && hover && color.toLowerCase() === hover.toLowerCase()) {
    return fallback;
  }
  if (color) return color;
  const marker = typeof properties?.['marker-color'] === 'string'
    ? properties['marker-color'].trim()
    : '';
  if (marker) return marker;
  return fallback;
}

/** Darkened key for lifted selection fill / rounded body. */
export function resolveFloatingBadgeSelectionAccentColor(
  properties: Record<string, unknown> | null | undefined,
  fallbackColor: string,
  selectedDarken?: number
): string {
  const annotated = properties?.[SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY];
  if (typeof annotated === 'string' && annotated.trim()) return annotated.trim();
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const amount =
    typeof selectedDarken === 'number' && Number.isFinite(selectedDarken)
      ? selectedDarken
      : tokens.selectedDarken;
  const resting = resolveFloatingBadgeSelectionKeyColor(properties, fallbackColor);
  return sharedPointFloatingBadgeSelectedColor(resting, amount);
}

/** MapLibre fill for the lifted selection badge — prefers annotated `_colorSelected`. */
export function sharedPointFloatingBadgeSelectionFillExpression(
  fallbackColor: string,
  options: {
    colorProperty?: string;
    selectedProperty?: string;
    selectedDarken?: number;
  } = {}
): unknown[] {
  const colorProperty = options.colorProperty ?? '_color';
  const selectedProperty =
    options.selectedProperty ?? SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY;
  const amount = options.selectedDarken ?? SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN;
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const darkFallback = sharedPointFloatingBadgeSelectedColor(
    sharedPointFloatingBadgeRestingColor(
      fallbackColor,
      tokens.restingBrighten,
      tokens.restingSaturate
    ),
    amount
  );
  return [
    'coalesce',
    ['get', selectedProperty],
    ['get', colorProperty],
    darkFallback,
  ];
}

const CATALOG_MARKER_PLACEHOLDER_COLORS = new Set(['#888888', '#888', '#a1a1aa']);

function isCatalogMarkerPlaceholderColor(color: string): boolean {
  return CATALOG_MARKER_PLACEHOLDER_COLORS.has(color.trim().toLowerCase());
}

/** Resting key color when painting / re-syncing GeoJSON (locker identity or per-feature brand). */
export function resolveFloatingBadgeAnnotateKeyColor(
  properties: Record<string, unknown>,
  fallbackColor: string,
  colorProperty = '_color'
): string {
  const fallback = fallbackColor.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  const key = properties[SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY];
  if (typeof key === 'string' && key.trim()) return key.trim();
  const resting = properties._colorResting;
  if (typeof resting === 'string' && resting.trim()) return resting.trim();

  const marker = properties['marker-color'];
  if (typeof marker === 'string' && marker.trim()) return marker.trim();

  const raw = properties[colorProperty];
  const color = typeof raw === 'string' ? raw.trim() : '';
  const hover = properties._colorHover;
  const hoverStr = typeof hover === 'string' ? hover.trim() : '';
  if (color && (!hoverStr || color.toLowerCase() !== hoverStr.toLowerCase())) {
    if (!isCatalogMarkerPlaceholderColor(color)) return color;
  }
  return fallback;
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
    softAmount = SHARED_POINT_FLOATING_BADGE_SOFT_BRIGHTEN,
    selectedProperty = SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
    selectedAmount = SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN,
    outerProperty = SHARED_POINT_FLOATING_BADGE_OUTER_COLOR_PROPERTY,
  } = options;
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const restingBrighten = options.restingBrighten ?? tokens.restingBrighten;
  const restingSaturate = options.restingSaturate ?? tokens.restingSaturate;
  const outerAmount = options.outerAmount ?? tokens.outerDarken;
  const forceFallbackKey = options.forceFallbackKey === true;
  const hoverColor = options.hoverColor?.trim() || '';
  const selectedColor = options.selectedColor?.trim() || '';
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) => {
      const props = feature.properties ?? {};
      const rawFill = forceFallbackKey
        ? fallbackColor.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR
        : resolveFloatingBadgeAnnotateKeyColor(
            props,
            fallbackColor,
            colorProperty as string
          );
      const resting = sharedPointFloatingBadgeRestingColor(
        rawFill,
        restingBrighten,
        restingSaturate
      );
      // forceFallbackKey: brightened resting IS the key (one vivid locker hue on the map).
      const keyColor = forceFallbackKey ? resting : rawFill;
      return {
        ...feature,
        properties: {
          ...props,
          // Bake fallback into `_color` so selection/hover lookups never lose the ring hue.
          [colorProperty]: resting,
          _colorResting: resting,
          [SHARED_POINT_FLOATING_BADGE_KEY_COLOR_PROPERTY]: keyColor,
          [softProperty]: sharedPointFloatingBadgeSoftColor(resting, softAmount),
          [hoverProperty]: hoverColor || lightenHexTowardWhite(resting, amount),
          [SHARED_POINT_DOT_COLOR_PROPERTY]: lightenHexTowardWhite(resting, tokens.dotLighten),
          [selectedProperty]:
            selectedColor || sharedPointFloatingBadgeSelectedColor(resting, selectedAmount),
          [outerProperty]: sharedPointFloatingBadgeOuterColor(resting, outerAmount),
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
  /** Selected badge bands — default to the resting widths. */
  selectedRingWidth: number;
  selectedOuterStrokeWidth: number;
  glassOpacity: number;
  glassBlur: number;
  glassPad: number;
  strokeOpacity: number;
  outerStrokeOpacity: number;
  hoverLighten: number;
  selectedDarken: number;
  /** Selected outer rim darken toward black (0–1). */
  outerDarken: number;
  hoverOuterStrokeWidth: number;
  hoverShadowScale: number;
  /** Resting shadow radius multiplier — below 1 tightens it into a contact dot. */
  shadowScale: number;
  selectedShadowScale: number;
  selectedShadowOpacity: number;
  /** Selected ground-shadow `circle-blur` (defaults to `shadowBlur`); lower = tighter edge. */
  selectedShadowBlur: number;
  /** Selected ground-shadow offset (px) — larger y peeks the contact spot out below the badge. */
  selectedShadowTranslate: [number, number];
  floatTranslate: [number, number];
  hoverTranslate: [number, number];
  selectedTranslate: [number, number];
  selectAnimationMs: number;
  hoverAnimationMs: number;
  /** Multiplies every badge radius stop (1 = default size). */
  sizeScale: number;
  /** Unselected key color — HSV value boost (0–1). */
  restingBrighten: number;
  /** Unselected key color — HSV saturation boost (0–1). */
  restingSaturate: number;
  /** Zoomed-out dot core mix toward white (0–1) — bright shining dots on dark basemaps. */
  dotLighten: number;
  /** Resting ground-shadow offset (px, deep zoom max). */
  shadowTranslate: [number, number];
  /** Resource glyph tint on the key-colored body. */
  glyphColor: string;
  /** Marker key when a feature has no color and the app passes none. */
  fallbackColor: string;
};

function defaultThemeElement(): Element | null {
  return typeof document !== 'undefined' ? document.documentElement : null;
}

/** Badge radius by zoom, scaled by `--gk-badge-size-scale`. */
export function sharedPointFloatingBadgeRadiusExpression(
  scale = getCSSVariableNumber(defaultThemeElement(), '--gk-badge-size-scale', 1)
): unknown[] {
  return scaleInterpolateRadiusStops(SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION, scale);
}

/** Read `--gk-badge-*` design tokens (fallback to shared-point constants). */
export function resolveSharedPointFloatingBadgeTokens(
  element: Element | null = defaultThemeElement()
): SharedPointFloatingBadgeTokens {
  const coloredRingWidth = getCSSVariableNumber(
    element,
    '--gk-badge-ring-width',
    SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH
  );
  const outerStrokeWidth = getCSSVariableNumber(
    element,
    '--gk-badge-outer-stroke-width',
    SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH
  );
  const shadowBlur = getCSSVariableNumber(
    element,
    '--gk-badge-shadow-blur',
    SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR
  );
  const shadowX = getCSSVariableNumber(
    element,
    '--gk-badge-shadow-x',
    SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[0]
  );
  const shadowY = getCSSVariableNumber(
    element,
    '--gk-badge-shadow-y',
    SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1]
  );
  return {
    sizeScale: getCSSVariableNumber(element, '--gk-badge-size-scale', 1),
    restingBrighten: getCSSVariableNumber(
      element,
      '--gk-badge-resting-brighten',
      SHARED_POINT_FLOATING_BADGE_RESTING_BRIGHTEN
    ),
    restingSaturate: getCSSVariableNumber(
      element,
      '--gk-badge-resting-saturate',
      SHARED_POINT_FLOATING_BADGE_RESTING_SATURATE
    ),
    dotLighten: getCSSVariableNumber(element, '--gk-badge-dot-lighten', 0),
    shadowTranslate: [shadowX, shadowY],
    glyphColor: getCSSVariable(
      element,
      '--gk-badge-glyph-color',
      SHARED_POINT_FLOATING_BADGE_FILL
    ),
    fallbackColor: getCSSVariable(
      element,
      '--gk-badge-fallback-color',
      SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR
    ),
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
    shadowBlur,
    shadowRadiusPad: getCSSVariableNumber(
      element,
      '--gk-badge-shadow-pad',
      SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD
    ),
    coloredRingWidth,
    outerStrokeWidth,
    selectedRingWidth: getCSSVariableNumber(
      element,
      '--gk-badge-selected-ring-width',
      coloredRingWidth
    ),
    selectedOuterStrokeWidth: getCSSVariableNumber(
      element,
      '--gk-badge-selected-outer-stroke-width',
      SHARED_POINT_FLOATING_BADGE_SELECTED_OUTER_STROKE_WIDTH
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
    selectedDarken: getCSSVariableNumber(
      element,
      '--gk-badge-selected-darken',
      SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN
    ),
    outerDarken: getCSSVariableNumber(
      element,
      '--gk-badge-outer-darken',
      SHARED_POINT_FLOATING_BADGE_OUTER_DARKEN
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
    shadowScale: getCSSVariableNumber(element, '--gk-badge-shadow-scale', 1),
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
    selectedShadowBlur: getCSSVariableNumber(
      element,
      '--gk-badge-selected-shadow-blur',
      shadowBlur
    ),
    selectedShadowTranslate: [
      getCSSVariableNumber(element, '--gk-badge-selected-shadow-x', shadowX),
      getCSSVariableNumber(element, '--gk-badge-selected-shadow-y', shadowY),
    ],
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
  /**
   * When true, GeoJSON annotate re-keys every feature from `fallbackColor`
   * (one locker identity color — no per-feature hue drift).
   */
  forceFallbackKey?: boolean;
  /**
   * When true, resting cores use the key color (not white fill) so pins don't
   * read as a second pale color next to solid key selection / rounded badges.
   */
  solidKeyCore?: boolean;
};

/**
 * Reusable floating-badge paint (ground shadow respects map pitch/perspective).
 * Look knobs come from `--gk-badge-*` design tokens; selection uses JS lift animation.
 * Pass into `createSharedPointLayersFromPaint` / orchestrator `getPaintConfig`.
 */
export function sharedPointFloatingBadgePaintExpressions(
  options: SharedPointFloatingBadgePaintOptions
) {
  const colorProperty = options.colorProperty ?? '_color';
  const softProperty = SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY;
  const tokens = resolveSharedPointFloatingBadgeTokens(
    options.themeElement === undefined ? defaultThemeElement() : options.themeElement
  );
  const fallbackColor = options.fallbackColor.trim() || tokens.fallbackColor;
  const restingFallback = sharedPointFloatingBadgeRestingColor(
    fallbackColor,
    tokens.restingBrighten,
    tokens.restingSaturate
  );
  const ringColor = ['coalesce', ['get', colorProperty], restingFallback];
  const selectedOuterFallback = sharedPointFloatingBadgeOuterColor(
    restingFallback,
    tokens.outerDarken
  );
  const selectedOuterColor = [
    'coalesce',
    ['get', SHARED_POINT_FLOATING_BADGE_OUTER_COLOR_PROPERTY],
    selectedOuterFallback,
  ];
  // Unselected: light paper outer; selected: keep darker key stroke on the same marker.
  const lightOuter = tokens.outerStrokeColor || SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR;
  const outerColor = sharedPointFeatureStateSelectedCase(selectedOuterColor, lightOuter);
  const softFallback = sharedPointFloatingBadgeSoftColor(restingFallback);
  const softFill = ['coalesce', ['get', softProperty], softFallback];
  const badgeRadius = sharedPointFloatingBadgeRadiusExpression(tokens.sizeScale);
  const restingShadow = scaleInterpolateRadiusStops(
    sharedPointFloatingBadgeShadowRadiusExpression(
      sharedPointFloatingBadgeOuterDiscRadius(
        badgeRadius,
        sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth),
        sharedPointFloatingBadgeOuterStrokeWidthExpression(tokens.outerStrokeWidth)
      ) as unknown[],
      tokens.shadowRadiusPad
    ),
    tokens.shadowScale
  );
  const floatTranslate = sharedPointFloatingBadgeTranslateExpression(tokens.floatTranslate[1]);
  const selectedTranslate = sharedPointFloatingBadgeTranslateExpression(
    tokens.selectedTranslate[1]
  );
  const shadowTranslate = sharedPointFloatingBadgeShadowTranslateExpression(
    tokens.shadowTranslate
  );
  const coreFill = options.solidKeyCore === true ? ringColor : tokens.fill;
  // MapLibre rejects `case` branches that are interpolate arrays for circle-radius —
  // keep resting shadow as a plain interpolate; selected uses selection-source shadow.
  return {
    // Unselected: light core + key ring + light outer; selected keeps darker outer + stronger cast.
    pointColorExpression: sharedPointZoomedOutStep(
      sharedPointDotColorExpression(ringColor),
      coreFill
    ),
    pointRadiusExpression: badgeRadius,
    // Plain string — some providers mishandle `['literal', '#000']` for circle-color.
    glowColorExpression: tokens.shadowColor,
    // Resting cast on the main source; selected uses selection-shadow (clearer under cast).
    glowOpacity: sharedPointFloatingBadgeShadowOpacityExpression(tokens.shadowOpacity),
    glowBlur: sharedPointFloatingBadgeShadowBlurExpression(tokens.shadowBlur),
    glowRadiusExpression: restingShadow,
    glowTranslate: shadowTranslate,
    glowPitchAlignment: SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT,
    glowPitchScale: SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE,
    glowTranslateAnchor: SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE_ANCHOR,
    pointTranslate: floatTranslate,
    // Hover keeps resting height (key glow behind); select lifts above the shadow.
    hoverTranslate: floatTranslate,
    /** Screen-space float — rest/select translate goes straight up, not map-north. */
    pointTranslateAnchor: 'viewport' as const,
    selectionShadowTranslate: shadowTranslate,
    selectionGroundBadge: true as const,
    selectionGroundBadgeFallbackColor: fallbackColor,
    /** Spare selection-source chrome (hidden) — outer matches selected darker key. */
    selectionFillExpression: tokens.fill,
    selectionStrokeColorExpression: ringColor as unknown[],
    selectionOuterStrokeColorExpression: selectedOuterColor as unknown[],
    selectedDarken: tokens.selectedDarken,
    selectedShadowScale: tokens.selectedShadowScale,
    selectedShadowOpacity: tokens.selectedShadowOpacity,
    /** Skip feature-state glow expand on the ground-shadow layer — hover uses `${glow}-hover`. */
    skipFeatureStateHoverGlow: true as const,
    strokeWidthExpression: sharedPointFloatingBadgeRingWidthExpression(
      tokens.coloredRingWidth
    ) as unknown[],
    strokeColorExpression: ringColor as unknown[],
    strokeOpacity: tokens.strokeOpacity,
    // Outer: light when idle; darker key stroke when feature-state selected.
    outerStrokeWidthExpression: sharedPointFloatingBadgeOuterStrokeWidthExpression(
      tokens.outerStrokeWidth
    ) as unknown[],
    outerStrokeColorExpression: outerColor as unknown[],
    outerStrokeOpacity: tokens.outerStrokeOpacity,
    glassColorExpression: softFill as unknown[],
    glassOpacity: tokens.glassOpacity,
    glassBlur: tokens.glassBlur,
    glassRadiusExpression: sharedPointFloatingBadgeGlassRadiusExpression(
      badgeRadius,
      sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth),
      sharedPointFloatingBadgeOuterStrokeWidthExpression(tokens.outerStrokeWidth),
      sharedPointFloatingBadgeGlassPadExpression(tokens.glassPad)
    ),
    paintRevision: SHARED_POINT_FLOATING_BADGE_PAINT_REVISION,
    selectAnimationMs: tokens.selectAnimationMs,
    hoverAnimationMs: tokens.hoverAnimationMs,
    selectedTranslate,
    // Resting stays visible on select — feature-state only darkens the ground cast.
    selectionGroundBadgeForceFallbackKey: options.forceFallbackKey === true,
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
  pointRadius: unknown[] = sharedPointFloatingBadgeRadiusExpression(),
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
  pointColorExpression: string | unknown[];
  pointRadiusExpression: unknown[];
  glowColorExpression?: string | unknown[];
  glowOpacity?: number | unknown[];
  primarySortProperty?: string;
  primarySortValue?: string;
  strokeWidthExpression?: unknown[];
  strokeColorExpression?: unknown[];
  /** Outer stroke outside the colored ring (e.g. white halo). */
  outerStrokeWidthExpression?: unknown[];
  outerStrokeColorExpression?: string | unknown[];
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
  /** `circle-translate-anchor` for the shadow (`viewport` = cast straight down the screen). */
  glowTranslateAnchor?: 'map' | 'viewport';
  /**
   * Point/badge offset in px `[x, y]` (MapLibre: negatives = left/up).
   * e.g. `[0, -5]` floats the badge above a ground shadow at the map spot.
   * May be a zoom interpolate of `['literal', [x, y]]`.
   */
  pointTranslate?: [number, number] | unknown[];
  /** Hover float translate (slightly higher than `pointTranslate`). Applied via JS on hover. */
  hoverTranslate?: [number, number] | unknown[];
  /** Selected badge lift translate (zoom expression or `[x, y]`). */
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
  /** Re-key every feature from `selectionGroundBadgeFallbackColor` on annotate. */
  selectionGroundBadgeForceFallbackKey?: boolean;
  /** App accent for hover ring (annotated onto `_colorHover`; JS hover patch uses it). */
  hoverRingColor?: string;
  /** App accent for selected ring (annotated onto `_colorSelected`; leave-restore uses it). */
  selectedRingColor?: string;
  /** Selected badge fill (darkened key-color core). */
  selectionFillExpression?: string | unknown[];
  /** Mix toward black for annotated `_colorSelected` (see `--gk-badge-selected-darken`). */
  selectedDarken?: number;
  /** Selected badge ring stroke (white chrome). */
  selectionStrokeColorExpression?: string | unknown[];
  /** Selected badge outer stroke (key-color chrome). */
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

export function sharedPointSelectionSourceHasFeature(map: MapInstance, sourceId: string): boolean {
  const src = map.getSource?.(`${sourceId}-selection`) as
    | { _data?: { features?: unknown[] } }
    | undefined;
  const features = src?._data?.features;
  return Array.isArray(features) && features.length > 0;
}

export function sharedPointSelectionSourcePrimaryProperties(
  map: MapInstance,
  sourceId: string
): Record<string, unknown> | undefined {
  const src = map.getSource?.(`${sourceId}-selection`) as
    | { _data?: { features?: Array<{ properties?: Record<string, unknown> }> } }
    | undefined;
  const feature = src?._data?.features?.[0];
  return feature?.properties;
}

/** Apply paint/layout overrides to an existing shared point layer set. */
export function applySharedPointLayerPaint(
  map: MapInstance,
  options: ApplySharedPointPaintOptions
): void {
  const {
    ids: { sourceId, glowLayerId, pointLayerId },
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
    glowTranslateAnchor,
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
    // Never hide the ground cast when selected — selection chrome draws above it.
    if (hoverPaint) {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', hoverPaint.glowOpacity);
    } else if (Array.isArray(glowOpacity)) {
      map.setPaintProperty?.(glowLayerId, 'circle-opacity', glowOpacity);
    } else if (glowOpacity != null) {
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
    if (glowTranslateAnchor != null) {
      map.setPaintProperty?.(glowLayerId, 'circle-translate-anchor', glowTranslateAnchor);
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
    const ringForRadius = Array.isArray(strokeWidthExpression)
      ? strokeWidthExpression
      : coloredRingWidth;
    // Fill to ring edge (seam plug) + circle-stroke rim (smooth outer edge).
    map.setPaintProperty?.(
      outerStrokeLayerId,
      'circle-radius',
      sharedPointFloatingBadgeOuterStrokeRadius(pointRadiusExpression, ringForRadius)
    );
    map.setPaintProperty?.(
      outerStrokeLayerId,
      'circle-stroke-width',
      sharedPointRestingOuterStrokeWidth(outerStrokeWidthExpression)
    );
    if (outerStrokeColorExpression != null) {
      map.setPaintProperty?.(
        outerStrokeLayerId,
        'circle-color',
        sharedPointZoomedOutStep('rgba(0,0,0,0)', outerStrokeColorExpression)
      );
      map.setPaintProperty?.(
        outerStrokeLayerId,
        'circle-stroke-color',
        outerStrokeColorExpression
      );
    }
    map.setPaintProperty?.(
      outerStrokeLayerId,
      'circle-opacity',
      pointOpacityExpression ?? outerStrokeOpacity ?? 1
    );
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
  }

  const glassLayerId = sharedPointGlassLayerId(pointLayerId);
  if (map.getLayer?.(glassLayerId) && glassRadiusExpression != null) {
    const glassPaint = sharedPointGlassPaint({
      glassRadius: glassRadiusExpression,
      glassColor: glassColorExpression ?? strokeColorExpression,
      glowColor: strokeColorExpression,
      pointRadius: pointRadiusExpression,
      ringWidth: strokeWidthExpression,
      glassOpacity,
      glassBlur,
    });
    for (const [prop, value] of Object.entries(glassPaint)) {
      map.setPaintProperty?.(glassLayerId, prop, value);
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
  if (
    map.getLayer?.(selectionBadgeLayerId) &&
    selectionGroundBadge &&
    !sharedPointSelectionSourceHasFeature(map, sourceId)
  ) {
    const fallback =
      options.selectionGroundBadgeFallbackColor?.trim() ||
      (Array.isArray(strokeColorExpression) &&
      strokeColorExpression[0] === 'coalesce' &&
      typeof strokeColorExpression[strokeColorExpression.length - 1] === 'string'
        ? (strokeColorExpression[strokeColorExpression.length - 1] as string)
        : SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR);
    // Resting palette on the selection stack — light core + key ring + white outer.
    const keyColorExpr = [
      'coalesce',
      ['get', '_color'],
      ['get', 'color'],
      ['get', 'marker-color'],
      fallback,
    ] as unknown[];
    const selectedFill = options.selectionFillExpression ?? SHARED_POINT_FLOATING_BADGE_FILL;
    const selectedStroke = options.selectionStrokeColorExpression ?? keyColorExpr;
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-color', selectedFill);
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-stroke-color', selectedStroke);
    const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
      Array.isArray(pointRadiusExpression)
        ? pointRadiusExpression
        : sharedPointFloatingBadgeRadiusExpression()
    );
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-radius', selectedRadius);
    map.setPaintProperty?.(selectionBadgeLayerId, 'circle-stroke-width', strokeWidthExpression);
    if (map.getLayer?.(selectionBadgeOuterLayerId) && outerStrokeWidthExpression != null) {
      const coloredRingWidth = literalNumberFromPaintExpression(strokeWidthExpression);
      const ringForRadius = Array.isArray(strokeWidthExpression)
        ? strokeWidthExpression
        : coloredRingWidth;
      const outerColor =
        options.selectionOuterStrokeColorExpression ?? SHARED_POINT_FLOATING_BADGE_FILL;
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-radius',
        sharedPointFloatingBadgeOuterStrokeRadius(selectedRadius, ringForRadius)
      );
      map.setPaintProperty?.(
        selectionBadgeOuterLayerId,
        'circle-stroke-width',
        outerStrokeWidthExpression
      );
      map.setPaintProperty?.(selectionBadgeOuterLayerId, 'circle-color', outerColor);
      map.setPaintProperty?.(selectionBadgeOuterLayerId, 'circle-stroke-color', outerColor);
    }
  }
  // Selection chrome opacity is owned by syncBadgeChrome / clear — do not force-hide here.

  const hoverGlowLayerId = `${glowLayerId}-hover`;
  if (map.getLayer?.(hoverGlowLayerId)) {
    map.setPaintProperty?.(
      hoverGlowLayerId,
      'circle-radius',
      SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION
    );
  }

  if (pointTranslateAnchor === 'viewport') {
    applySharedPointLayersAbove3dExtrusions(map, { glowLayerId, pointLayerId });
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

export * from './shared-point/layer-ids';
export {
  darkenHexTowardBlack,
  lightenHexTowardWhite,
  mixHexColors,
} from '@local-hosting/geokit/core';
export { SHARED_POINT_BADGE_ICON_PROPERTY } from './shared-point-badge-constants';
