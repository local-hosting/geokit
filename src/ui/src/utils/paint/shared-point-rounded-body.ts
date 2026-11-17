import type { MapInstance } from '../../providers/types';
import {
  DEFAULT_STYLE_IMAGE_RASTER_SIZE,
  STYLE_IMAGE_PIXEL_RATIO,
  reserveMapStyleImageIds,
  styleImageLayoutPixels,
} from '../map-surface/map-style-images';
import { registerBadgeIconImage } from './shared-point-badge-icon';
import { roundedRectSdfRaster, roundedRectShadowRaster } from './rounded-rect-raster';
import {
  hideRoundedShadowLayer,
  GK_ROUNDED_RECT_SHADOW_IMAGE_ID,
  sharedPointRoundedShadowLayerId,
  sharedPointSelectionRoundedShadowLayerId,
} from './shared-point-rounded-shadow';
import type { ApplySharedPointPaintOptions } from './shared-point-paint';
import {
  literalNumberFromPaintExpression,
  scaleInterpolateRadiusStops,
  sharedPointFloatingBadgeRadiusExpression,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgeRingWidthExpression,
  resolveFloatingBadgeSelectionAccentColor,
  resolveSharedPointFloatingBadgeTokens,
  SHARED_POINT_FLOATING_BADGE_FILL,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeSelectionFillExpression,
  sharedPointFloatingBadgeTranslateExpression,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  hideFloatingBadgeCircleSelectionLayers,
  sharedPointSelectionSourceHasFeature,
  sharedPointSelectionSourcePrimaryProperties,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
  sharedPointDotColorExpression,
  sharedPointZoomedOutStep,
} from './shared-point-paint';
import { SHARED_POINT_BADGE_ICON_PROPERTY } from './shared-point-badge-constants';
import { markerBodyShapeFromProperties } from '../markers/marker-shape';
import { sharedPointPointBadgeIconLayerId, sharedPointSelectionBadgeIconLayerId } from './shared-point-badge-icon';
import {
  sharedPointRoundedRectBodyFilter,
  SHARED_POINT_MARKER_SHAPE_PROPERTY,
} from '../markers/marker-shape';

/** SDF sprite id — tinted via `icon-color` on the rounded body symbol layer. */
export const GK_ROUNDED_RECT_MARKER_IMAGE_ID = 'gk-marker-rounded-rect';
export function sharedPointRoundedBodyLayerId(pointLayerId: string): string {
  return `${pointLayerId}-rounded-body`;
}

export function sharedPointRoundedOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-rounded-outer`;
}

export function sharedPointRoundedRingLayerId(pointLayerId: string): string {
  return `${pointLayerId}-rounded-ring`;
}

export function sharedPointSelectionRoundedRingLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-rounded-ring`;
}

export function sharedPointSelectionRoundedBodyLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-rounded-body`;
}

export function sharedPointSelectionRoundedOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-rounded-outer`;
}

export function sharedPointMapHasDrawableCanvas(map: MapInstance): boolean {
  const canvas = (map as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.();
  return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
}

function registerRoundedRectImage(
  map: MapInstance,
  id: string,
  data: Uint8ClampedArray,
  sdf: boolean
): void {
  const size = DEFAULT_STYLE_IMAGE_RASTER_SIZE;
  // Always replace — `styleimagemissing` may have installed a 1×1 placeholder first.
  registerBadgeIconImage(
    map,
    id,
    { width: size, height: size, data },
    { sdf, pixelRatio: STYLE_IMAGE_PIXEL_RATIO }
  );
}

export function registerRoundedRectMarkerImage(map: MapInstance): boolean {
  if (!sharedPointMapHasDrawableCanvas(map)) return false;
  reserveMapStyleImageIds(GK_ROUNDED_RECT_MARKER_IMAGE_ID, GK_ROUNDED_RECT_SHADOW_IMAGE_ID);
  const size = DEFAULT_STYLE_IMAGE_RASTER_SIZE;
  registerRoundedRectImage(map, GK_ROUNDED_RECT_MARKER_IMAGE_ID, roundedRectSdfRaster(size), true);
  registerRoundedRectImage(
    map,
    GK_ROUNDED_RECT_SHADOW_IMAGE_ID,
    roundedRectShadowRaster(size, resolveSharedPointFloatingBadgeTokens().shadowBlur),
    false
  );
  return true;
}

/** `icon-size` so on-screen diameter ≈ `2 * circle-radius` (uses logical sprite width). */
const ICON_DIAMETER_PER_RADIUS = 2 / styleImageLayoutPixels();

function coerceZoomRadiusInterpolation(radiusExpr: unknown): unknown[] {
  if (Array.isArray(radiusExpr) && radiusExpr[0] === 'interpolate') return radiusExpr;
  return sharedPointFloatingBadgeRadiusExpression();
}

export function sharedPointRoundedBodyIconSizeExpression(
  pointRadius: unknown = sharedPointFloatingBadgeRadiusExpression()
): unknown[] {
  return scaleInterpolateRadiusStops(
    coerceZoomRadiusInterpolation(pointRadius),
    ICON_DIAMETER_PER_RADIUS
  );
}

/** Colored ring band — matches circle `circle-stroke` outer edge. */
export function sharedPointRoundedRingIconSizeExpression(
  pointRadius: unknown = sharedPointFloatingBadgeRadiusExpression(),
  coloredRingWidth: number | unknown[] = 0
): unknown[] {
  const core = coerceZoomRadiusInterpolation(pointRadius);
  const ringRadiusExpr = sharedPointFloatingBadgeOuterStrokeRadius(core, coloredRingWidth);
  if (Array.isArray(ringRadiusExpr) && ringRadiusExpr[0] === 'interpolate') {
    return scaleInterpolateRadiusStops(ringRadiusExpr, ICON_DIAMETER_PER_RADIUS);
  }
  const ringPad = literalNumberFromPaintExpression(coloredRingWidth);
  const expanded = [...core];
  for (let i = 4; i < expanded.length; i += 2) {
    if (typeof expanded[i] === 'number') expanded[i] = (expanded[i] as number) + ringPad;
  }
  return scaleInterpolateRadiusStops(expanded, ICON_DIAMETER_PER_RADIUS);
}

/** Full badge disc radius — matches circle outer-stroke + white band sizing. */
export function sharedPointRoundedOuterIconSizeExpression(
  pointRadius: unknown = sharedPointFloatingBadgeRadiusExpression(),
  coloredRingWidth: number | unknown[] = 0,
  outerStrokeWidth: number | unknown[] = 0
): unknown[] {
  const core = coerceZoomRadiusInterpolation(pointRadius);
  const outerRadiusExpr = sharedPointFloatingBadgeOuterDiscRadius(
    core,
    coloredRingWidth,
    outerStrokeWidth
  );
  if (Array.isArray(outerRadiusExpr) && outerRadiusExpr[0] === 'interpolate') {
    return scaleInterpolateRadiusStops(outerRadiusExpr, ICON_DIAMETER_PER_RADIUS);
  }
  const ringPad =
    literalNumberFromPaintExpression(coloredRingWidth) +
    literalNumberFromPaintExpression(outerStrokeWidth);
  if (ringPad <= 0) {
    return sharedPointRoundedBodyIconSizeExpression(core);
  }
  const expanded = [...core];
  for (let i = 4; i < expanded.length; i += 2) {
    if (typeof expanded[i] === 'number') expanded[i] = (expanded[i] as number) + ringPad;
  }
  return scaleInterpolateRadiusStops(expanded, ICON_DIAMETER_PER_RADIUS);
}

export function sharedPointRoundedBodyIconColorExpression(
  fallbackColor: string,
  colorExpression?: unknown
): unknown[] {
  if (colorExpression != null) return colorExpression as unknown[];
  return [
    'coalesce',
    ['get', '_color'],
    ['get', '_colorResting'],
    fallbackColor,
  ];
}

/**
 * Resting rounded outer band — same feature-state light/dark outer as circles; hidden zoomed out.
 */
export function sharedPointRestingRoundedOuterColor(
  paint?: Pick<ApplySharedPointPaintOptions, 'outerStrokeColorExpression'>
): unknown[] {
  const outer =
    paint?.outerStrokeColorExpression ?? SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR;
  return sharedPointZoomedOutStep('rgba(0,0,0,0)', outer);
}

function restingRoundedChromeFromPaint(
  paint: Pick<
    ApplySharedPointPaintOptions,
    | 'pointRadiusExpression'
    | 'strokeWidthExpression'
    | 'outerStrokeWidthExpression'
    | 'strokeColorExpression'
    | 'outerStrokeColorExpression'
    | 'pointColorExpression'
    | 'selectionGroundBadgeFallbackColor'
  >,
  fallback: string
) {
  const pointRadius = paint.pointRadiusExpression ?? sharedPointFloatingBadgeRadiusExpression();
  const keyRing = sharedPointRoundedBodyIconColorExpression(fallback, paint.strokeColorExpression);
  const outerColor = sharedPointRestingRoundedOuterColor(paint);
  // Light core + key ring (same as circles) — key-tinted glyph stays visible on paper.
  const coreColor =
    paint.pointColorExpression ??
    sharedPointZoomedOutStep(sharedPointDotColorExpression(keyRing), SHARED_POINT_FLOATING_BADGE_FILL);
  // Zoomed out: no ring band (matches circle stroke width 0) — tiny core on the glow only.
  const ringColor = sharedPointZoomedOutStep('rgba(0,0,0,0)', keyRing);
  return {
    pointRadius,
    coreColor,
    ringColor,
    outerColor,
    coreSize: sharedPointRoundedBodyIconSizeExpression(pointRadius),
    ringSize: sharedPointRoundedRingIconSizeExpression(pointRadius, paint.strokeWidthExpression),
    outerSize: sharedPointRoundedOuterIconSizeExpression(
      pointRadius,
      paint.strokeWidthExpression,
      paint.outerStrokeWidthExpression
    ),
    glyphColor: sharedPointZoomedOutStep('rgba(0,0,0,0)', keyRing),
  };
}

export function applySharedPointRoundedRectChromePaint(
  map: MapInstance,
  pointLayerId: string,
  paint: Pick<
    ApplySharedPointPaintOptions,
    | 'ids'
    | 'pointRadiusExpression'
    | 'strokeWidthExpression'
    | 'outerStrokeWidthExpression'
    | 'strokeColorExpression'
    | 'outerStrokeColorExpression'
    | 'pointColorExpression'
    | 'pointTranslate'
    | 'selectedTranslate'
    | 'selectionGroundBadgeFallbackColor'
    | 'pointOpacityExpression'
    | 'selectionGroundBadge'
    | 'selectedDarken'
  >
): void {
  // Legacy square sprite shadows must stay off even when ensure() is skipped.
  hideRoundedShadowLayer(map, sharedPointRoundedShadowLayerId(pointLayerId));
  hideRoundedShadowLayer(map, sharedPointSelectionRoundedShadowLayerId(pointLayerId));
  const fallback = paint.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  const resting = restingRoundedChromeFromPaint(paint, fallback);
  const iconTranslate =
    paint.pointTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
    coerceZoomRadiusInterpolation(resting.pointRadius)
  );
  const sourceId = paint.ids?.sourceId;
  const selectionActive = Boolean(sourceId && sharedPointSelectionSourceHasFeature(map, sourceId));

  if (selectionActive && sourceId && paint.selectionGroundBadge) {
    // Shadow-only select — never swap in a second selection-source marker.
    hideFloatingBadgeCircleSelectionLayers(map, pointLayerId);
  }

  const restingLayers = [
    [sharedPointRoundedOuterLayerId(pointLayerId), resting.outerSize, resting.outerColor],
    [sharedPointRoundedRingLayerId(pointLayerId), resting.ringSize, resting.ringColor],
    [sharedPointRoundedBodyLayerId(pointLayerId), resting.coreSize, resting.coreColor],
  ] as const;

  const selectionLayers = [
    [
      sharedPointSelectionRoundedOuterLayerId(pointLayerId),
      sharedPointRoundedOuterIconSizeExpression(
        selectedRadius,
        paint.strokeWidthExpression,
        paint.outerStrokeWidthExpression
      ),
      resting.outerColor,
    ],
    [
      sharedPointSelectionRoundedRingLayerId(pointLayerId),
      sharedPointRoundedRingIconSizeExpression(selectedRadius, paint.strokeWidthExpression),
      resting.ringColor,
    ],
    [
      sharedPointSelectionRoundedBodyLayerId(pointLayerId),
      sharedPointRoundedBodyIconSizeExpression(selectedRadius),
      resting.coreColor,
    ],
  ] as const;

  // Only paint the resting stack — selection-source rounded layers stay hidden.
  for (const [layerId, size, color] of restingLayers) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-size', size);
      map.setPaintProperty(layerId, 'icon-color', color);
      map.setPaintProperty(layerId, 'icon-translate', iconTranslate);
      map.setPaintProperty(layerId, 'icon-opacity', 1);
    } catch {
      /* style swap */
    }
  }

  for (const [layerId] of selectionLayers) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-opacity', 0);
    } catch {
      /* style swap */
    }
  }

  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
  if (map.getLayer?.(pointIconId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(pointIconId, 'icon-color', resting.glyphColor);
      map.setPaintProperty(pointIconId, 'icon-translate', iconTranslate);
      map.setPaintProperty(pointIconId, 'icon-opacity', 1);
    } catch {
      /* style swap */
    }
  }

  hideFloatingBadgeCircleSelectionLayers(map, pointLayerId);
}

/**
 * Selected rounded-rect colors — light core + key ring + white outer (matches resting).
 * Key-tinted glyph stays visible on the paper fill. Zoomed out: solid key body.
 */
function selectionRoundedColors(accent: unknown, _outerAccent: unknown, white: unknown) {
  return {
    outer: sharedPointZoomedOutStep('rgba(0,0,0,0)', white),
    ring: sharedPointZoomedOutStep('rgba(0,0,0,0)', accent),
    body: sharedPointZoomedOutStep(accent, white),
    glyph: sharedPointZoomedOutStep('rgba(0,0,0,0)', accent),
  };
}

/** Selected rounded-rect chrome — same tokens/radii as circle selection. */
export function applySharedPointRoundedRectSelectionChrome(
  map: MapInstance,
  pointLayerId: string,
  options: {
    accentColor: string;
    outerAccentColor?: string;
    white: string;
    selectedRadius: unknown;
    ringWidth: number | unknown[];
    outerStrokeWidth: number;
    iconTranslate: unknown;
  }
): void {
  const colors = selectionRoundedColors(
    options.accentColor,
    options.outerAccentColor ?? options.accentColor,
    options.white
  );
  const bodySize = sharedPointRoundedBodyIconSizeExpression(options.selectedRadius);
  const ringSize = sharedPointRoundedRingIconSizeExpression(options.selectedRadius, options.ringWidth);
  const outerSize = sharedPointRoundedOuterIconSizeExpression(
    options.selectedRadius,
    options.ringWidth,
    options.outerStrokeWidth
  );
  const screenTranslate = sharedPointFloatingBadgeNormalizeViewportTranslate(
    options.iconTranslate as [number, number] | unknown[]
  );
  for (const [layerId, size, color] of [
    [sharedPointSelectionRoundedOuterLayerId(pointLayerId), outerSize, colors.outer],
    [sharedPointSelectionRoundedRingLayerId(pointLayerId), ringSize, colors.ring],
    [sharedPointSelectionRoundedBodyLayerId(pointLayerId), bodySize, colors.body],
  ] as const) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-size', size);
      map.setPaintProperty(layerId, 'icon-color', color);
      map.setPaintProperty(layerId, 'icon-translate-anchor', 'viewport');
      map.setPaintProperty(layerId, 'icon-translate', screenTranslate);
    } catch {
      /* style swap */
    }
  }
  const iconLayerId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
  if (map.getLayer?.(iconLayerId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(iconLayerId, 'icon-color', colors.glyph);
      map.setPaintProperty(iconLayerId, 'icon-opacity', 1);
    } catch {
      /* style swap */
    }
  }
}

/** @deprecated Use {@link applySharedPointRoundedRectSelectionChrome}. */
export const applySharedPointRoundedResourceSelectionChrome =
  applySharedPointRoundedRectSelectionChrome;

function buildRoundedSymbolLayerSpec(options: {
  id: string;
  source: string;
  iconSize: unknown;
  iconColor: unknown;
  iconTranslate: unknown;
  iconImage?: string;
}): Record<string, unknown> {
  return {
    id: options.id,
    type: 'symbol',
    source: options.source,
    filter: sharedPointRoundedRectBodyFilter(),
    layout: {
      'icon-image': options.iconImage ?? GK_ROUNDED_RECT_MARKER_IMAGE_ID,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'center',
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'icon-size': options.iconSize,
    },
    paint: {
      'icon-color': options.iconColor,
      'icon-opacity': 1,
      'icon-translate': options.iconTranslate,
      'icon-translate-anchor': 'viewport',
    },
  };
}

export type EnsureSharedPointRoundedChromeOptions = {
  sourceId: string;
  pointLayerId: string;
  fallbackColor: string;
  pointIconTranslate?: unknown[];
  pointRadius?: unknown;
  coloredRingWidth?: number | unknown[];
  outerStrokeWidth?: number | unknown[];
  ringColorExpression?: unknown;
  outerColorExpression?: unknown | string;
  /** Resting drop shadow — pass the circle glow paint so both shapes cast the same shadow. */
  shadowRadius?: unknown;
  shadowOpacity?: unknown;
  shadowTranslate?: unknown;
  /** When set, layered below this id on add. */
  beforeId?: string;
};

function ensureRoundedSymbolLayer(
  map: MapInstance,
  options: EnsureSharedPointRoundedChromeOptions,
  layerId: string,
  iconSize: unknown,
  iconColor: unknown
): void {
  if (!map.getSource?.(options.sourceId) || map.getLayer?.(layerId) || !map.addLayer) return;
  const iconTranslate =
    options.pointIconTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);
  try {
    map.addLayer(
      buildRoundedSymbolLayerSpec({
        id: layerId,
        source: options.sourceId,
        iconSize,
        iconColor,
        iconTranslate,
      }) as never,
      options.beforeId
    );
  } catch {
    /* style swap */
  }
}

export function ensureSharedPointRoundedRectChromeLayers(
  map: MapInstance,
  options: EnsureSharedPointRoundedChromeOptions
): void {
  if (!sharedPointMapHasDrawableCanvas(map)) return;
  if (!registerRoundedRectMarkerImage(map)) return;

  const pointRadius = options.pointRadius ?? sharedPointFloatingBadgeRadiusExpression();
  const ringWidth = options.coloredRingWidth ?? 0;
  const outerWidth = options.outerStrokeWidth ?? 0;
  const ringColor = sharedPointRoundedBodyIconColorExpression(
    options.fallbackColor,
    options.ringColorExpression
  );
  const outerColor =
    options.outerColorExpression != null
      ? options.outerColorExpression
      : ['literal', '#ffffff'];

  const outerLayerId = sharedPointRoundedOuterLayerId(options.pointLayerId);
  const ringLayerId = sharedPointRoundedRingLayerId(options.pointLayerId);
  const bodyLayerId = sharedPointRoundedBodyLayerId(options.pointLayerId);

  hideRoundedShadowLayer(map, sharedPointRoundedShadowLayerId(options.pointLayerId));
  ensureRoundedSymbolLayer(
    map,
    options,
    outerLayerId,
    sharedPointRoundedOuterIconSizeExpression(pointRadius, ringWidth, outerWidth),
    outerColor
  );
  ensureRoundedSymbolLayer(
    map,
    options,
    ringLayerId,
    sharedPointRoundedRingIconSizeExpression(pointRadius, ringWidth),
    ringColor
  );
  ensureRoundedSymbolLayer(
    map,
    options,
    bodyLayerId,
    sharedPointRoundedBodyIconSizeExpression(pointRadius),
    ringColor
  );
}

/** Selection-source rounded rects (lifted via icon-translate). */
export function ensureSharedPointSelectionRoundedRectChromeLayers(
  map: MapInstance,
  options: EnsureSharedPointRoundedChromeOptions
): void {
  const selectionSourceId = `${options.sourceId}-selection`;
  if (!map.getSource?.(selectionSourceId)) return;
  if (!sharedPointMapHasDrawableCanvas(map) || !registerRoundedRectMarkerImage(map)) return;

  const tokens = resolveSharedPointFloatingBadgeTokens();
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
    coerceZoomRadiusInterpolation(
      options.pointRadius ?? sharedPointFloatingBadgeRadiusExpression()
    )
  );
  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.selectedRingWidth);
  const outerWidth = sharedPointFloatingBadgeOuterStrokeWidthExpression(
    tokens.selectedOuterStrokeWidth
  );
  const fillColor = sharedPointFloatingBadgeSelectionFillExpression(options.fallbackColor, {
    selectedDarken: tokens.selectedDarken,
  });
  const colors = selectionRoundedColors(fillColor, fillColor, tokens.fill);
  const iconTranslate =
    options.pointIconTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);

  const outerId = sharedPointSelectionRoundedOuterLayerId(options.pointLayerId);
  const ringId = sharedPointSelectionRoundedRingLayerId(options.pointLayerId);
  const bodyId = sharedPointSelectionRoundedBodyLayerId(options.pointLayerId);
  const beforeId = map.getLayer?.(`${options.pointLayerId}-selection-badge-icon`)
    ? `${options.pointLayerId}-selection-badge-icon`
    : `${options.pointLayerId}-selection-badge`;

  hideRoundedShadowLayer(map, sharedPointSelectionRoundedShadowLayerId(options.pointLayerId));

  for (const [layerId, size, color] of [
    [
      outerId,
      sharedPointRoundedOuterIconSizeExpression(selectedRadius, ringWidth, outerWidth),
      colors.outer,
    ],
    [ringId, sharedPointRoundedRingIconSizeExpression(selectedRadius, ringWidth), colors.ring],
    [bodyId, sharedPointRoundedBodyIconSizeExpression(selectedRadius), colors.body],
  ] as const) {
    if (map.getLayer?.(layerId) && map.setPaintProperty) {
      try {
        map.setPaintProperty(layerId, 'icon-size', size);
        map.setPaintProperty(layerId, 'icon-color', color);
        map.setPaintProperty(layerId, 'icon-translate', iconTranslate);
      } catch {
        /* style swap */
      }
      continue;
    }
    if (map.getLayer?.(layerId)) continue;
    try {
      map.addLayer(
        buildRoundedSymbolLayerSpec({
          id: layerId,
          source: selectionSourceId,
          iconSize: size,
          iconColor: color,
          iconTranslate,
        }) as never,
        beforeId
      );
    } catch {
      /* style swap */
    }
  }
}

/** Legacy alias — only adds the body layer. */
export type EnsureSharedPointRoundedBodyLayersOptions = EnsureSharedPointRoundedChromeOptions;

export function ensureSharedPointRoundedBodyLayers(
  map: MapInstance,
  options: EnsureSharedPointRoundedBodyLayersOptions
): void {
  ensureSharedPointRoundedRectChromeLayers(map, options);
}

export { SHARED_POINT_MARKER_SHAPE_PROPERTY };