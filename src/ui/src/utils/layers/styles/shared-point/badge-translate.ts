/** Badge translate and ring-color animation. */
import type { MapInstance } from '../../../../providers/types';
import type { Feature } from '@local-hosting/geokit/core/types';
import { getFeatureId } from '@local-hosting/geokit/core/geojson';
import { getCSSVariable, getCSSVariableNumber } from '../../../map-surface/theme';
import { debug } from '../../../map-surface/logger';
import { HOVER_CONFIG, type HoverStateHandlers } from '../../../map-surface/feature-state-hover';
import {
  buildSharedPointFeatureStateHoverPaint,
  expandInterpolateCaseMultiply,
  literalNumberFromPaintExpression,
  resolveSharedPointFloatingBadgeTokens,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
  lightenHexTowardWhite,
  sharedPointFloatingBadgeGlassRadiusExpression,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeSelectionTranslateAt,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeTranslatesNearlyEqual,
  sharedPointGlassLayerId,
  sharedPointHitLayerIds,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointOuterStrokeLayerId,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
  sharedPointFloatingBadgeSelectionFillExpression,
  resolveFloatingBadgeSelectionKeyColor,
  resolveFloatingBadgeSelectionAccentColor,
  SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
  syncSharedPointSelectedLayerFilter,
} from '../../../paint/shared-point-paint';
import {
  sharedPointBadgeVariantFromProperties,
  syncBadgeChrome,
} from '../../../markers/badge';
import { sharedPointCircleBodyFilter, trySetLayerFilter } from '../../../markers/marker-shape';
import { ensureFloatingBadgeSelectionChrome } from '../../../markers/marker-selection-chrome';
import {
  ensureSharedPointBadgeIconLayers,
  syncBadgeIconTranslate,
  raiseSharedPointBadgeIconLayersOnTop,
  SHARED_POINT_BADGE_ICON_PROPERTY,
  syncSelectionBadgeIconTranslate,
  sharedPointSelectionBadgeIconLayerId,
} from '../../../paint/shared-point-badge-icon';
import { resolveSharedPointLayerIdForSource } from '../../../shared-points/shared-point-heal';
import {
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
  sharedPointSelectionRoundedRingLayerId,
} from '../../../paint/shared-point-rounded-body';

// ============================================================================
// Types
// ============================================================================

import type { SharedPointLayersConfig, CircleStyleOptions } from '../types';
import {
  getPointRadiusInterpolation, getGlowRadiusInterpolation, SELECTION_RING_STROKE_WIDTH, SELECTION_RING_GAP_PX,
} from '../circle-glow';
import { offsetRadiusInterpolation } from '../category-expressions';
import { omitNil } from '../circle-glow';
import {
  resolveGlowBlur, resolveGlowOpacity, resolveSharedGlowColor, resolveDefaultLayerColor, resolveDefaultStrokeColor,
  resolveMapTilerHelperPointColor,
} from '../types';

import {
  hoverBadgeAnimByMap,
  hoverRingColorAnimByMap,
  selectionBadgeAnimByMap,
  type HoverRingColorTarget,
} from './animation-state';
function hoverRingColorLayerId(
  pointLayerId: string,
  target: HoverRingColorTarget
): string {
  return target === 'selection'
    ? sharedPointSelectionBadgeLayerId(pointLayerId)
    : sharedPointHoverBadgeLayerId(pointLayerId);
}

function setHoverBadgeRingColor(
  map: MapInstance,
  pointLayerId: string,
  color: string,
  target: HoverRingColorTarget
): void {
  if (!map.setPaintProperty) return;
  const layerId = hoverRingColorLayerId(pointLayerId, target);
  if (!map.getLayer?.(layerId)) return;
  try {
    if (target === 'selection') {
      // Selected: lighten key-color core + outer ring; middle ring stays white.
      map.setPaintProperty(layerId, 'circle-color', color);
      map.setPaintProperty(
        layerId,
        'circle-stroke-color',
        resolveSharedPointFloatingBadgeTokens().fill
      );
      const outerId = sharedPointSelectionBadgeOuterLayerId(pointLayerId);
      if (map.getLayer?.(outerId)) {
        map.setPaintProperty(outerId, 'circle-color', color);
      }
      return;
    }
    // Unselected hover: lighten the key ring stroke (core stays white).
    map.setPaintProperty(layerId, 'circle-stroke-color', color);
  } catch {
    /* style swap */
  }
}

export function cancelHoverBadgeRingColorAnimation(map: MapInstance, pointLayerId: string): void {
  const byLayer = hoverRingColorAnimByMap.get(map);
  if (!byLayer) return;
  const rafId = byLayer.get(pointLayerId);
  if (rafId == null) return;
  cancelAnimationFrame(rafId);
  byLayer.delete(pointLayerId);
}

/** Ease badge ring between resting key color and lit hover tint. */
export function animateSharedPointHoverBadgeRingColor(
  map: MapInstance,
  pointLayerId: string,
  options: {
    from: string;
    to: string;
    target?: HoverRingColorTarget;
    durationMs?: number;
    onFrame?: (color: string) => void;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  const durationMs = options.durationMs ?? tokens.hoverAnimationMs;
  const target = options.target ?? 'hover';
  const { from, to, onFrame, onDone } = options;

  cancelHoverBadgeRingColorAnimation(map, pointLayerId);
  setHoverBadgeRingColor(map, pointLayerId, from, target);
  onFrame?.(from);

  if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
    setHoverBadgeRingColor(map, pointLayerId, to, target);
    onFrame?.(to);
    onDone?.();
    return;
  }

  let byLayer = hoverRingColorAnimByMap.get(map);
  if (!byLayer) {
    byLayer = new Map();
    hoverRingColorAnimByMap.set(map, byLayer);
  }
  const anims = byLayer;
  const start = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    anims.delete(pointLayerId);
    onDone?.();
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    const color = sharedPointFloatingBadgeHoverRingColorAt(from, to, elapsed, durationMs);
    setHoverBadgeRingColor(map, pointLayerId, color, target);
    onFrame?.(color);
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    anims.set(pointLayerId, requestAnimationFrame(tick));
  };

  anims.set(pointLayerId, requestAnimationFrame(tick));
}

function selectionBadgeLayerIds(pointLayerId: string): [string, string] {
  return [
    sharedPointSelectionBadgeLayerId(pointLayerId),
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
  ];
}

function hoverBadgeLayerIds(pointLayerId: string): [string, string] {
  return [
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
  ];
}

function setBadgeLayersTranslate(
  map: MapInstance,
  layerIds: readonly string[],
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  // Viewport anchor + x=0 — lift is straight up on screen away from the shadow.
  const screenTranslate = sharedPointFloatingBadgeNormalizeViewportTranslate(translate);
  for (const layerId of layerIds) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setPaintProperty(layerId, 'circle-translate-anchor', 'viewport');
      map.setPaintProperty(layerId, 'circle-translate', screenTranslate);
    } catch {
      /* style swap */
    }
  }
}

function setHoverBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  setBadgeLayersTranslate(map, hoverBadgeLayerIds(pointLayerId), translate);
}

export function setSelectionBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  setBadgeLayersTranslate(map, selectionBadgeLayerIds(pointLayerId), translate);
  for (const layerId of [
    sharedPointSelectionRoundedOuterLayerId(pointLayerId),
    sharedPointSelectionRoundedRingLayerId(pointLayerId),
    sharedPointSelectionRoundedBodyLayerId(pointLayerId),
  ]) {
    if (!map.getLayer?.(layerId) || !map.setPaintProperty) continue;
    try {
      map.setPaintProperty(layerId, 'icon-translate', translate);
    } catch {
      /* style swap */
    }
  }
  syncSelectionBadgeIconTranslate(map, pointLayerId, translate);
}

/** Numeric circle-translate already written by JS animation, if any. */
function readNumericBadgeTranslate(
  map: MapInstance,
  layerIds: readonly string[]
): [number, number] | null {
  if (!map.getPaintProperty) return null;
  for (const layerId of layerIds) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      const value = map.getPaintProperty(layerId, 'circle-translate');
      if (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof value[0] === 'number' &&
        typeof value[1] === 'number'
      ) {
        return [value[0], value[1]];
      }
    } catch {
      /* style swap */
    }
  }
  return null;
}

function cancelBadgeRaf(
  store: WeakMap<MapInstance, Map<string, number>>,
  map: MapInstance,
  pointLayerId: string
): void {
  const byLayer = store.get(map);
  if (!byLayer) return;
  const rafId = byLayer.get(pointLayerId);
  if (rafId == null) return;
  cancelAnimationFrame(rafId);
  byLayer.delete(pointLayerId);
}

export function cancelHoverBadgeAnimation(map: MapInstance, pointLayerId: string): void {
  cancelBadgeRaf(hoverBadgeAnimByMap, map, pointLayerId);
}

export function cancelSelectionBadgeAnimation(map: MapInstance, pointLayerId: string): void {
  cancelBadgeRaf(selectionBadgeAnimByMap, map, pointLayerId);
}

/** Shared rAF ease for hover/select badge translate. */
function scheduleBadgeTranslateAnimation(input: {
  store: WeakMap<MapInstance, Map<string, number>>;
  map: MapInstance;
  pointLayerId: string;
  from: [number, number];
  to: [number, number];
  durationMs: number;
  apply: (translate: [number, number]) => void;
  onDone?: () => void;
}): void {
  const { store, map, pointLayerId, from, to, durationMs, apply, onDone } = input;
  cancelBadgeRaf(store, map, pointLayerId);
  if (sharedPointFloatingBadgeTranslatesNearlyEqual(from, to)) {
    apply(to);
    onDone?.();
    return;
  }
  apply(from);
  if (typeof requestAnimationFrame !== 'function' || durationMs <= 0) {
    apply(to);
    onDone?.();
    return;
  }

  let byLayer = store.get(map);
  if (!byLayer) {
    byLayer = new Map();
    store.set(map, byLayer);
  }
  const anims = byLayer;
  const start = performance.now();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    anims.delete(pointLayerId);
    onDone?.();
  };

  const tick = (now: number) => {
    const elapsed = now - start;
    apply(sharedPointFloatingBadgeSelectionTranslateAt(from, to, elapsed, durationMs));
    if (elapsed >= durationMs) {
      finish();
      return;
    }
    anims.set(pointLayerId, requestAnimationFrame(tick));
  };

  anims.set(pointLayerId, requestAnimationFrame(tick));
}

/** Ease hover-overlay badge between rest and hover height. */
export function animateSharedPointHoverBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  options: {
    from: [number, number];
    to: [number, number];
    durationMs?: number;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  scheduleBadgeTranslateAnimation({
    store: hoverBadgeAnimByMap,
    map,
    pointLayerId,
    from: options.from,
    to: options.to,
    durationMs: options.durationMs ?? tokens.hoverAnimationMs,
    apply: (translate) => setHoverBadgeTranslate(map, pointLayerId, translate),
    onDone: options.onDone,
  });
}

/** Ease selection badge from resting height up to selected (or custom from/to). */
export function animateSharedPointSelectionBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  options?: {
    from?: [number, number];
    to?: [number, number];
    durationMs?: number;
    onDone?: () => void;
  }
): void {
  const tokens = resolveSharedPointFloatingBadgeTokens();
  // Prefer current paint translate so a second select/re-apply does not snap down to rest.
  // Token screen offsets (not zoom-scaled): Places fly must not settle the pop.
  const from =
    options?.from ??
    readNumericBadgeTranslate(map, selectionBadgeLayerIds(pointLayerId)) ??
    tokens.floatTranslate;
  const to = options?.to ?? tokens.selectedTranslate;
  scheduleBadgeTranslateAnimation({
    store: selectionBadgeAnimByMap,
    map,
    pointLayerId,
    from,
    to,
    durationMs: options?.durationMs ?? tokens.selectAnimationMs,
    apply: (translate) => setSelectionBadgeTranslate(map, pointLayerId, translate),
    onDone: () => {
      raiseSharedPointBadgeIconLayersOnTop(map, pointLayerId);
      options?.onDone?.();
    },
  });
}
