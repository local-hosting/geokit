import type { MapInstance } from '../../providers/types';
import { DEFAULT_STYLE_IMAGE_RASTER_SIZE } from '../map-surface/map-style-images';
import { registerBadgeIconImage } from './shared-point-badge-icon';
import type { ApplySharedPointPaintOptions } from './shared-point-paint';
import {
  literalNumberFromPaintExpression,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeTranslateExpression,
  sharedPointSelectionSourceHasFeature,
} from './shared-point-paint';
import { sharedPointPointBadgeIconLayerId, sharedPointSelectionBadgeIconLayerId } from './shared-point-badge-icon';
import {
  sharedPointRoundedRectBodyFilter,
  SHARED_POINT_MARKER_SHAPE_PROPERTY,
} from '../markers/marker-shape';

/** SDF sprite id — tinted via `icon-color` on the rounded body symbol layer. */
export const GK_ROUNDED_RECT_MARKER_IMAGE_ID = 'gk-marker-rounded-rect';

const BODY_CORNER_RADIUS_RATIO = 0.22;

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

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRoundedRectSdfRaster(size: number): Uint8ClampedArray | null {
  if (typeof document === 'undefined' || size < 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const pad = size * 0.08;
  const r = size * BODY_CORNER_RADIUS_RATIO;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, r);
  } else {
    pathRoundedRect(ctx, pad, pad, size - pad * 2, size - pad * 2, r);
  }
  ctx.fill();
  return ctx.getImageData(0, 0, size, size).data;
}

export function sharedPointMapHasDrawableCanvas(map: MapInstance): boolean {
  const canvas = (map as { getCanvas?: () => HTMLCanvasElement }).getCanvas?.();
  return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
}

export function registerRoundedRectMarkerImage(map: MapInstance): boolean {
  if (!sharedPointMapHasDrawableCanvas(map)) return false;
  if (map.hasImage?.(GK_ROUNDED_RECT_MARKER_IMAGE_ID)) return true;
  const size = DEFAULT_STYLE_IMAGE_RASTER_SIZE;
  const data = drawRoundedRectSdfRaster(size);
  if (!data || data.length !== size * size * 4) return false;
  try {
    map.removeImage?.(GK_ROUNDED_RECT_MARKER_IMAGE_ID);
  } catch {
    /* first add */
  }
  registerBadgeIconImage(
    map,
    GK_ROUNDED_RECT_MARKER_IMAGE_ID,
    {
      width: size,
      height: size,
      data,
    },
    { sdf: true }
  );
  return true;
}

/** `icon-size` so on-screen diameter ≈ `2 * circle-radius` (radius stops × 2/width). */
const ICON_DIAMETER_PER_RADIUS = 2 / DEFAULT_STYLE_IMAGE_RASTER_SIZE;

function coerceZoomRadiusInterpolation(radiusExpr: unknown): unknown[] {
  if (Array.isArray(radiusExpr) && radiusExpr[0] === 'interpolate') return radiusExpr;
  return SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
}

export function sharedPointRoundedBodyIconSizeExpression(
  pointRadius: unknown = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION
): unknown[] {
  return scaleInterpolateRadiusStops(
    coerceZoomRadiusInterpolation(pointRadius),
    ICON_DIAMETER_PER_RADIUS
  );
}

/** Colored ring band — matches circle `circle-stroke` outer edge. */
export function sharedPointRoundedRingIconSizeExpression(
  pointRadius: unknown = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  coloredRingWidth: unknown = 0
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
  pointRadius: unknown = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  coloredRingWidth: unknown = 0,
  outerStrokeWidth: unknown = 0
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
  const pointRadius = paint.pointRadiusExpression ?? SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
  const coreColor = paint.pointColorExpression ?? ['literal', '#ffffff'];
  const ringColor = sharedPointRoundedBodyIconColorExpression(fallback, paint.strokeColorExpression);
  const outerColor = paint.outerStrokeColorExpression ?? ['literal', '#ffffff'];
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
    glyphColor: ringColor,
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
  >
): void {
  const fallback = paint.selectionGroundBadgeFallbackColor?.trim() || '#888888';
  const resting = restingRoundedChromeFromPaint(paint, fallback);
  const iconTranslate =
    paint.pointTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
    coerceZoomRadiusInterpolation(resting.pointRadius)
  );
  const sourceId = paint.ids?.sourceId;
  const selectionActive = Boolean(sourceId && sharedPointSelectionSourceHasFeature(map, sourceId));

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

  const layersToPaint = selectionActive
    ? restingLayers
    : ([...restingLayers, ...selectionLayers] as const);

  for (const [layerId, size, color] of layersToPaint) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-size', size);
      map.setPaintProperty(layerId, 'icon-color', color);
      map.setPaintProperty(layerId, 'icon-translate', iconTranslate);
    } catch {
      /* style swap */
    }
  }

  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
  if (map.getLayer?.(pointIconId) && map.setPaintProperty) {
    try {
      map.setPaintProperty(pointIconId, 'icon-color', resting.glyphColor);
      map.setPaintProperty(pointIconId, 'icon-translate', iconTranslate);
    } catch {
      /* style swap */
    }
  }

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
    ringWidth: unknown;
    outerStrokeWidth: number;
    iconTranslate: unknown;
  }
): void {
  const outerAccent = options.outerAccentColor ?? options.accentColor;
  const bodySize = sharedPointRoundedBodyIconSizeExpression(options.selectedRadius);
  const ringSize = sharedPointRoundedRingIconSizeExpression(options.selectedRadius, options.ringWidth);
  const outerSize = sharedPointRoundedOuterIconSizeExpression(
    options.selectedRadius,
    options.ringWidth,
    options.outerStrokeWidth
  );
  for (const [layerId, size, color] of [
    [sharedPointSelectionRoundedOuterLayerId(pointLayerId), outerSize, outerAccent],
    [sharedPointSelectionRoundedRingLayerId(pointLayerId), ringSize, options.white],
    [sharedPointSelectionRoundedBodyLayerId(pointLayerId), bodySize, options.accentColor],
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
      map.setPaintProperty(iconLayerId, 'icon-color', options.accentColor);
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
}): Record<string, unknown> {
  return {
    id: options.id,
    type: 'symbol',
    source: options.source,
    filter: sharedPointRoundedRectBodyFilter(),
    layout: {
      'icon-image': GK_ROUNDED_RECT_MARKER_IMAGE_ID,
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
  coloredRingWidth?: unknown;
  outerStrokeWidth?: unknown;
  coreColorExpression?: unknown;
  ringColorExpression?: unknown;
  outerColorExpression?: unknown | string;
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

  const pointRadius = options.pointRadius ?? SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
  const ringWidth = options.coloredRingWidth ?? 0;
  const outerWidth = options.outerStrokeWidth ?? 0;
  const coreColor =
    options.coreColorExpression != null
      ? options.coreColorExpression
      : ['literal', '#ffffff'];
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
    coreColor
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

  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression(
    options.pointRadius ?? SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION
  );
  const ringWidth = options.coloredRingWidth ?? 0;
  const outerWidth = options.outerStrokeWidth ?? 0;
  const coreColor =
    options.coreColorExpression != null
      ? options.coreColorExpression
      : ['literal', '#ffffff'];
  const ringColor = sharedPointRoundedBodyIconColorExpression(
    options.fallbackColor,
    options.ringColorExpression
  );
  const outerColor =
    options.outerColorExpression != null
      ? options.outerColorExpression
      : ['literal', '#ffffff'];
  const iconTranslate =
    options.pointIconTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);

  const outerId = sharedPointSelectionRoundedOuterLayerId(options.pointLayerId);
  const ringId = sharedPointSelectionRoundedRingLayerId(options.pointLayerId);
  const bodyId = sharedPointSelectionRoundedBodyLayerId(options.pointLayerId);
  const beforeId = map.getLayer?.(`${options.pointLayerId}-selection-badge-icon`)
    ? `${options.pointLayerId}-selection-badge-icon`
    : `${options.pointLayerId}-selection-badge`;

  for (const [layerId, size, color] of [
    [
      outerId,
      sharedPointRoundedOuterIconSizeExpression(selectedRadius, ringWidth, outerWidth),
      outerColor,
    ],
    [ringId, sharedPointRoundedRingIconSizeExpression(selectedRadius, ringWidth), ringColor],
    [bodyId, sharedPointRoundedBodyIconSizeExpression(selectedRadius), coreColor],
  ] as const) {
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