import type { MapInstance } from '../../providers/types';
import {
  DEFAULT_STYLE_IMAGE_RASTER_SIZE,
  STYLE_IMAGE_PIXEL_RATIO,
  styleImageLayoutPixels,
} from '../map-surface/map-style-images';
import { registerBadgeIconImage } from './shared-point-badge-icon';
import { roundedRectSdfRaster, roundedRectShadowRaster } from './rounded-rect-raster';
import {
  ensureRoundedShadowLayer,
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
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeSelectionFillExpression,
  sharedPointFloatingBadgeShadowOpacityExpression,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeShadowTranslateExpression,
  sharedPointFloatingBadgeTranslateExpression,
  hideFloatingBadgeCircleSelectionLayers,
  sharedPointSelectionSourceHasFeature,
  sharedPointSelectionSourcePrimaryProperties,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
  sharedPointDotColorExpression,
  sharedPointRestingGlyphColor,
  sharedPointSelectedMiddleRingColor,
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
  if (map.hasImage?.(id)) return;
  const size = DEFAULT_STYLE_IMAGE_RASTER_SIZE;
  registerBadgeIconImage(
    map,
    id,
    { width: size, height: size, data },
    { sdf, pixelRatio: STYLE_IMAGE_PIXEL_RATIO }
  );
}

export function registerRoundedRectMarkerImage(map: MapInstance): boolean {
  if (!sharedPointMapHasDrawableCanvas(map)) return false;
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
 * Resting rounded outer band: white rim zoomed in; hidden zoomed out, where the
 * shape-agnostic glass layer draws the shining-dot glow instead.
 */
export function sharedPointRestingRoundedOuterColor(
  paint: Pick<ApplySharedPointPaintOptions, 'outerStrokeColorExpression'>
): unknown[] {
  const outerColor = paint.outerStrokeColorExpression ?? ['literal', '#ffffff'];
  return sharedPointZoomedOutStep('rgba(0,0,0,0)', outerColor);
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
  const ringColor = sharedPointRoundedBodyIconColorExpression(fallback, paint.strokeColorExpression);
  const outerColor = sharedPointRestingRoundedOuterColor(paint);
  return {
    pointRadius,
    coreColor: sharedPointZoomedOutStep(sharedPointDotColorExpression(ringColor), ringColor),
    ringColor,
    outerColor,
    coreSize: sharedPointRoundedBodyIconSizeExpression(pointRadius),
    ringSize: sharedPointRoundedRingIconSizeExpression(pointRadius, paint.strokeWidthExpression),
    outerSize: sharedPointRoundedOuterIconSizeExpression(
      pointRadius,
      paint.strokeWidthExpression,
      paint.outerStrokeWidthExpression
    ),
    glyphColor: sharedPointRestingGlyphColor(resolveSharedPointFloatingBadgeTokens().glyphColor),
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
    const props = sharedPointSelectionSourcePrimaryProperties(map, sourceId);
  const shape =
    markerBodyShapeFromProperties(props) === 'rounded-rect' ||
    (typeof props?.[SHARED_POINT_BADGE_ICON_PROPERTY] === 'string' &&
      props[SHARED_POINT_BADGE_ICON_PROPERTY].trim())
      ? 'rounded-rect'
      : 'circle';
    if (shape === 'rounded-rect') {
      const fallback = paint.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
      const accent = resolveFloatingBadgeSelectionAccentColor(
        props,
        fallback,
        paint.selectedDarken
      );
      const tokens = resolveSharedPointFloatingBadgeTokens();
      const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.selectedRingWidth);
      const outerStrokeWidth = tokens.selectedOuterStrokeWidth;
      applySharedPointRoundedRectSelectionChrome(map, pointLayerId, {
        accentColor: accent,
        white: SHARED_POINT_FLOATING_BADGE_FILL,
        selectedRadius,
        ringWidth,
        outerStrokeWidth,
        iconTranslate:
          paint.selectedTranslate ??
          paint.pointTranslate ??
          sharedPointFloatingBadgeTranslateExpression(tokens.selectedTranslate[1]),
      });
      hideFloatingBadgeCircleSelectionLayers(map, pointLayerId);
      return;
    }
    return;
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

  const layersToPaint = [...restingLayers, ...selectionLayers] as const;

  const restingIconOpacity =
    paint.selectionGroundBadge && paint.pointOpacityExpression != null
      ? paint.pointOpacityExpression
      : 1;

  for (const [layerId, size, color] of layersToPaint) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    const isRestingRounded =
      layerId.includes('-rounded-') && !layerId.includes('-selection-rounded-');
    try {
      map.setPaintProperty(layerId, 'icon-size', size);
      map.setPaintProperty(layerId, 'icon-color', color);
      map.setPaintProperty(layerId, 'icon-translate', iconTranslate);
      if (isRestingRounded) {
        map.setPaintProperty(layerId, 'icon-opacity', restingIconOpacity);
      }
    } catch {
      /* style swap */
    }
  }

  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
  if (map.getLayer?.(pointIconId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(pointIconId, 'icon-color', resting.glyphColor);
      map.setPaintProperty(pointIconId, 'icon-translate', iconTranslate);
      if (paint.selectionGroundBadge && paint.pointOpacityExpression != null) {
        map.setPaintProperty(pointIconId, 'icon-opacity', restingIconOpacity);
      }
    } catch {
      /* style swap */
    }
  }

}

/**
 * Selected rounded-rect colors: white body + key outer zoomed in; zoomed out a solid key
 * marker — the selection ring layer draws the white ring with a gap around it.
 */
function selectionRoundedColors(accent: unknown, outerAccent: unknown, white: unknown) {
  return {
    outer: sharedPointZoomedOutStep('rgba(0,0,0,0)', outerAccent),
    ring: sharedPointSelectedMiddleRingColor(accent, white),
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
  for (const [layerId, size, color] of [
    [sharedPointSelectionRoundedOuterLayerId(pointLayerId), outerSize, colors.outer],
    [sharedPointSelectionRoundedRingLayerId(pointLayerId), ringSize, colors.ring],
    [sharedPointSelectionRoundedBodyLayerId(pointLayerId), bodySize, colors.body],
  ] as const) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-size', size);
      map.setPaintProperty(layerId, 'icon-color', color);
      map.setPaintProperty(layerId, 'icon-translate', options.iconTranslate);
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
  const tokens = resolveSharedPointFloatingBadgeTokens();

  ensureRoundedShadowLayer(map, {
    layerId: sharedPointRoundedShadowLayerId(options.pointLayerId),
    source: options.sourceId,
    beforeId: options.beforeId,
    shadowRadius:
      options.shadowRadius ??
      sharedPointFloatingBadgeShadowRadiusExpression(undefined, tokens.shadowRadiusPad),
    opacity:
      options.shadowOpacity ?? sharedPointFloatingBadgeShadowOpacityExpression(tokens.shadowOpacity),
    translate: options.shadowTranslate ?? sharedPointFloatingBadgeShadowTranslateExpression(),
  });
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

  ensureRoundedShadowLayer(map, {
    layerId: sharedPointSelectionRoundedShadowLayerId(options.pointLayerId),
    source: selectionSourceId,
    beforeId,
    shadowRadius: scaleInterpolateRadiusStops(
      sharedPointFloatingBadgeShadowRadiusExpression(undefined, tokens.shadowRadiusPad),
      tokens.selectedShadowScale
    ),
    opacity: tokens.selectedShadowOpacity,
    translate: tokens.selectedShadowTranslate,
  });

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