import type { MapInstance } from '../../providers/types';
import { SHARED_POINT_BADGE_ICON_PROPERTY } from '../paint/shared-point-badge-constants';
import {
  sharedPointBadgeIconSizeExpression,
  sharedPointBadgeIconSizeForGlyphDiskExpression,
} from '../paint/shared-point-badge-icon-sizing';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import {
  resolveSharedPointFloatingBadgeTokens,
  resolveFloatingBadgeSelectionAccentColor,
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointFloatingBadgeRadiusExpression,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointSelectedMiddleRingColor,
  hideFloatingBadgeCircleSelectionLayers,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
  sharedPointSelectionSourceHasFeature,
  sharedPointSelectionSourcePrimaryProperties,
  SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
} from '../paint/shared-point-paint';
import {
  applySharedPointRoundedRectSelectionChrome,
  ensureSharedPointSelectionRoundedRectChromeLayers,
  sharedPointSelectionRoundedBodyLayerId,
} from '../paint/shared-point-rounded-body';
import { markerBodyShapeFromProperties, type MarkerBodyShape } from './marker-shape';

function readMapPaintProperty(map: MapInstance, layerId: string, property: string): unknown {
  if (!map.getLayer?.(layerId) || !map.getPaintProperty) return undefined;
  try {
    return map.getPaintProperty(layerId, property);
  } catch {
    return undefined;
  }
}

function setMapProps(
  map: MapInstance,
  paint: ReadonlyArray<readonly [layerId: string, prop: string, value: unknown]>,
  layout: ReadonlyArray<readonly [layerId: string, prop: string, value: unknown]> = []
): void {
  for (const [layerId, prop, value] of paint) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, prop, value);
    } catch {
      /* style swap */
    }
  }
  for (const [layerId, prop, value] of layout) {
    if (!map.getLayer?.(layerId) || !map.setLayoutProperty) continue;
    try {
      map.setLayoutProperty(layerId, prop, value);
    } catch {
      /* style swap */
    }
  }
}

/** Same shape rules as the floating-badge marker factory (places vs resources). */
export function floatingBadgeBodyShapeFromProperties(
  properties: Record<string, unknown> | null | undefined
): MarkerBodyShape {
  const fromProperty = markerBodyShapeFromProperties(properties);
  if (fromProperty === 'rounded-rect') return 'rounded-rect';
  const icon = properties?.[SHARED_POINT_BADGE_ICON_PROPERTY];
  if (typeof icon === 'string' && icon.trim()) return 'rounded-rect';
  return 'circle';
}

/** Darkened key fill for lifted selection chrome (body / circle core). */
export function floatingBadgeSelectionAccentFromProperties(
  properties: Record<string, unknown> | null | undefined,
  fallback: string
): string {
  return resolveFloatingBadgeSelectionAccentColor(properties, fallback);
}

export function buildFloatingBadgeRoundedChromeOptions(
  ids: SharedPointLayerIds,
  paint: Pick<
    ApplySharedPointPaintOptions,
    | 'selectionGroundBadgeFallbackColor'
    | 'pointRadiusExpression'
    | 'strokeWidthExpression'
    | 'outerStrokeWidthExpression'
    | 'pointTranslate'
    | 'selectedTranslate'
  >
) {
  const shapeFallback = paint.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  const tokens = resolveSharedPointFloatingBadgeTokens();
  return {
    sourceId: ids.sourceId,
    pointLayerId: ids.pointLayerId,
    fallbackColor: shapeFallback,
    pointIconTranslate: paint.selectedTranslate ?? paint.pointTranslate ?? tokens.selectedTranslate,
    pointRadius: paint.pointRadiusExpression ?? sharedPointFloatingBadgeRadiusExpression(),
    coloredRingWidth: paint.strokeWidthExpression,
    outerStrokeWidth: paint.outerStrokeWidthExpression,
  };
}

export function ensureFloatingBadgeSelectionChrome(
  map: MapInstance,
  ids: SharedPointLayerIds,
  paint: Pick<
    ApplySharedPointPaintOptions,
    | 'selectionGroundBadgeFallbackColor'
    | 'pointRadiusExpression'
    | 'strokeWidthExpression'
    | 'outerStrokeWidthExpression'
    | 'pointTranslate'
    | 'selectedTranslate'
  >
): void {
  ensureSharedPointSelectionRoundedRectChromeLayers(map, buildFloatingBadgeRoundedChromeOptions(ids, paint));
}

export type FloatingBadgeSelectionChromeOptions = {
  /** Darkened key fill (body / core). */
  accentColor: string;
  /** Resting key on the outer ring — defaults to `accentColor`. */
  outerAccentColor?: string;
  shape: MarkerBodyShape;
};

/** Selected grounded badge: key fill + white ring + key outer (places and resources). */
export type FloatingBadgeSelectedChromeSpec = {
  accentColor: string;
  outerAccentColor: string;
  white: string;
  selectedRadius: unknown;
  ringWidth: number | unknown[];
  outerStrokeWidth: number;
  outerStrokeWidthExpression: unknown;
  outerDiscRadius: unknown;
};

export function buildFloatingBadgeSelectedChromeSpec(
  accentColor: string,
  outerAccentColor: string = accentColor
): FloatingBadgeSelectedChromeSpec {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const white = SHARED_POINT_FLOATING_BADGE_FILL;
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.selectedRingWidth);
  const outerStrokeWidthExpression = sharedPointFloatingBadgeOuterStrokeWidthExpression(
    tokens.selectedOuterStrokeWidth
  );
  return {
    accentColor,
    outerAccentColor,
    white,
    selectedRadius,
    ringWidth,
    outerStrokeWidth: tokens.selectedOuterStrokeWidth,
    outerStrokeWidthExpression,
    outerDiscRadius: sharedPointFloatingBadgeOuterStrokeRadius(selectedRadius, ringWidth),
  };
}

function applyCircleFloatingBadgeSelectionChrome(
  map: MapInstance,
  pointLayerId: string,
  spec: FloatingBadgeSelectedChromeSpec,
  iconSize: unknown
): void {
  const badgeId = sharedPointSelectionBadgeLayerId(pointLayerId);
  const badgeOuterId = sharedPointSelectionBadgeOuterLayerId(pointLayerId);
  const iconLayerId = `${pointLayerId}-selection-badge-icon`;
  setMapProps(
    map,
    [
      [badgeId, 'circle-color', spec.accentColor],
      [badgeId, 'circle-radius', spec.selectedRadius],
      [badgeId, 'circle-stroke-width', spec.ringWidth],
      [badgeId, 'circle-stroke-opacity', 1],
      [badgeId, 'circle-stroke-color', sharedPointSelectedMiddleRingColor(spec.accentColor, spec.white)],
      [badgeId, 'circle-opacity', 1],
      [badgeOuterId, 'circle-color', spec.outerAccentColor],
      [badgeOuterId, 'circle-stroke-color', spec.outerAccentColor],
      [badgeOuterId, 'circle-radius', spec.outerDiscRadius],
      [badgeOuterId, 'circle-stroke-width', spec.outerStrokeWidthExpression],
      [badgeOuterId, 'circle-opacity', 1],
      [badgeOuterId, 'circle-stroke-opacity', 1],
      [iconLayerId, 'icon-opacity', 0],
    ],
    [[iconLayerId, 'icon-size', iconSize]]
  );
}

function applyRoundedFloatingBadgeSelectionChrome(
  map: MapInstance,
  pointLayerId: string,
  spec: FloatingBadgeSelectedChromeSpec,
  iconTranslate: unknown,
  iconSize: unknown
): void {
  const iconLayerId = `${pointLayerId}-selection-badge-icon`;
  hideFloatingBadgeCircleSelectionLayers(map, pointLayerId);
  applySharedPointRoundedRectSelectionChrome(map, pointLayerId, {
    accentColor: spec.accentColor,
    outerAccentColor: spec.outerAccentColor,
    white: spec.white,
    selectedRadius: spec.selectedRadius,
    ringWidth: spec.ringWidth,
    outerStrokeWidth: spec.outerStrokeWidth,
    iconTranslate,
  });
  setMapProps(
    map,
    [
      [iconLayerId, 'icon-opacity', 1],
    ],
    [[iconLayerId, 'icon-size', iconSize]]
  );
}

/**
 * One code path for grounded selection chrome — circle stack (places) or rounded stack (resources).
 * Layer filters scope geometry; this applies the matching paints and glyph scale.
 */
export function applyFloatingBadgeSelectionChrome(
  map: MapInstance,
  pointLayerId: string,
  options: FloatingBadgeSelectionChromeOptions
): void {
  const badgeId = sharedPointSelectionBadgeLayerId(pointLayerId);
  const roundedBodyId = sharedPointSelectionRoundedBodyLayerId(pointLayerId);
  if (!map.getLayer?.(badgeId) && !map.getLayer?.(roundedBodyId)) return;

  const tokens = resolveSharedPointFloatingBadgeTokens();
  const spec = buildFloatingBadgeSelectedChromeSpec(
    options.accentColor,
    options.outerAccentColor ?? options.accentColor
  );
  const iconSize =
    options.shape === 'rounded-rect'
      ? sharedPointBadgeIconSizeForGlyphDiskExpression()
      : sharedPointBadgeIconSizeExpression();

  if (options.shape === 'rounded-rect') {
    const iconTranslate =
      readMapPaintProperty(map, roundedBodyId, 'icon-translate') ??
      readMapPaintProperty(map, badgeId, 'circle-translate') ??
      tokens.selectedTranslate;
    applyRoundedFloatingBadgeSelectionChrome(map, pointLayerId, spec, iconTranslate, iconSize);
    return;
  }

  applyCircleFloatingBadgeSelectionChrome(map, pointLayerId, spec, iconSize);
}

export function reapplyFloatingBadgeSelectionChromeIfActive(
  map: MapInstance,
  ids: SharedPointLayerIds,
  paint: Pick<ApplySharedPointPaintOptions, 'ids' | 'selectionGroundBadgeFallbackColor'>
): void {
  const sourceId = paint.ids?.sourceId ?? ids.sourceId;
  if (!sharedPointSelectionSourceHasFeature(map, sourceId)) return;
  const properties = sharedPointSelectionSourcePrimaryProperties(map, sourceId);
  const fallback = paint.selectionGroundBadgeFallbackColor?.trim() || SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR;
  applyFloatingBadgeSelectionChrome(map, ids.pointLayerId, {
    accentColor: floatingBadgeSelectionAccentFromProperties(properties, fallback),
    shape: floatingBadgeBodyShapeFromProperties(properties),
  });
}