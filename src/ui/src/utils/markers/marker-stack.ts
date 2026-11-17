import type { MapInstance } from '../../providers/types';
import { getSharedPointSelection } from '../layers/styles/shared-point-layers';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import { syncSharedPointSelectedLayerFilter } from '../paint/shared-point-paint';
import {
  ensureSharedPointBadgeIconLayers,
  raiseSharedPointBadgeIconLayersOnTop,
  sharedPointPointBadgeIconLayerId,
} from '../paint/shared-point-badge-icon';
import {
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointGlassLayerId,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
} from '../paint/shared-point-paint';
import {
  applySharedPointRoundedRectChromePaint,
  ensureSharedPointRoundedRectChromeLayers,
  sharedPointRoundedBodyLayerId,
  sharedPointRoundedOuterLayerId,
  sharedPointRoundedRingLayerId,
  sharedPointRestingRoundedOuterColor,
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
  sharedPointSelectionRoundedRingLayerId,
} from '../paint/shared-point-rounded-body';
import {
  buildFloatingBadgeRoundedChromeOptions,
  ensureFloatingBadgeSelectionChrome,
  reapplyFloatingBadgeSelectionChromeIfActive,
} from './marker-selection-chrome';
import {
  sharedPointCircleBodyFilter,
  sharedPointCircleBodyLayerIds,
  sharedPointGroundShadowLayerIds,
  sharedPointRoundedRectBodyFilter,
  sharedPointSelectionLiftLayerIds,
  trySetLayerFilter,
} from './marker-shape';

export type FloatingBadgeStack = {
  /** Soft circle ground glow — casts for every marker shape. */
  shadow: readonly string[];
  /** Circle floating badge (places). */
  circleBody: readonly string[];
  /** Rounded-rect chrome on the main source (resources). */
  roundedResting: readonly string[];
  /** Circle selection chrome (places). */
  selectionCircle: readonly string[];
  /** Rounded-rect selection chrome (resources). */
  selectionRounded: readonly string[];
  /** Selected badge layers (both shapes + glyph) that lift together; shadows stay grounded. */
  selectionLift: readonly string[];
  /** Hover + ring helpers shared by both shapes. */
  interaction: readonly string[];
  /** Full stack for inventory / teardown. */
  all: readonly string[];
};

export function floatingBadgeRoundedRestingLayerIds(pointLayerId: string): string[] {
  return [
    sharedPointRoundedOuterLayerId(pointLayerId),
    sharedPointRoundedRingLayerId(pointLayerId),
    sharedPointRoundedBodyLayerId(pointLayerId),
    sharedPointPointBadgeIconLayerId(pointLayerId),
  ];
}

export function floatingBadgeSelectionRoundedLayerIds(pointLayerId: string): string[] {
  return [
    sharedPointSelectionRoundedOuterLayerId(pointLayerId),
    sharedPointSelectionRoundedRingLayerId(pointLayerId),
    sharedPointSelectionRoundedBodyLayerId(pointLayerId),
    `${pointLayerId}-selection-badge-icon`,
  ];
}

export const floatingBadgeSelectionLiftLayerIds = sharedPointSelectionLiftLayerIds;

/** Set the selected badge's screen offset on every lift layer, circle or symbol alike. */
export function setFloatingBadgeSelectionLift(
  map: MapInstance,
  ids: Pick<SharedPointLayerIds, 'pointLayerId'>,
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  const screenTranslate = sharedPointFloatingBadgeNormalizeViewportTranslate(translate);
  for (const layerId of floatingBadgeSelectionLiftLayerIds(ids.pointLayerId)) {
    let layer: { type?: string } | undefined;
    try {
      layer = map.getLayer?.(layerId) as { type?: string } | undefined;
    } catch {
      continue;
    }
    if (!layer) continue;
    const prefix = layer.type === 'circle' ? 'circle' : 'icon';
    try {
      map.setPaintProperty(layerId, `${prefix}-translate-anchor`, 'viewport');
      map.setPaintProperty(layerId, `${prefix}-translate`, screenTranslate);
    } catch {
      /* style swap */
    }
  }
}

export function buildFloatingBadgeStack(ids: SharedPointLayerIds): FloatingBadgeStack {
  const { glowLayerId, pointLayerId } = ids;
  const shadow = sharedPointGroundShadowLayerIds(glowLayerId);
  const circleBody = sharedPointCircleBodyLayerIds(pointLayerId);
  const roundedResting = floatingBadgeRoundedRestingLayerIds(pointLayerId);
  const selectionCircle = [
    `${pointLayerId}-selection-shadow`,
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
    sharedPointSelectionBadgeLayerId(pointLayerId),
    `${pointLayerId}-selection-ring`,
  ];
  const selectionRounded = floatingBadgeSelectionRoundedLayerIds(pointLayerId);
  const interaction = [
    `${pointLayerId}-hover`,
    `${glowLayerId}-hover`,
    `${pointLayerId}-hover-badge`,
    `${pointLayerId}-hover-badge-outer`,
  ];
  const glassId = sharedPointGlassLayerId(pointLayerId);
  const all = [
    ...new Set([
      ...shadow,
      ...circleBody,
      glassId,
      ...roundedResting,
      ...selectionCircle,
      ...selectionRounded,
      ...interaction,
    ]),
  ];
  return {
    shadow,
    circleBody,
    roundedResting,
    selectionCircle,
    selectionRounded,
    selectionLift: floatingBadgeSelectionLiftLayerIds(pointLayerId),
    interaction,
    all,
  };
}

/** Shape split — badge bodies by shape; soft circle glow casts for every marker. */
export function syncFloatingBadgeStackShapeFilters(
  map: MapInstance,
  ids: SharedPointLayerIds
): void {
  if (!map.setFilter) return;
  const stack = buildFloatingBadgeStack(ids);
  const circleFilter = sharedPointCircleBodyFilter();
  const roundedFilter = sharedPointRoundedRectBodyFilter();

  for (const layerId of stack.shadow) {
    trySetLayerFilter(map, layerId, null);
  }
  for (const layerId of stack.circleBody) {
    trySetLayerFilter(map, layerId, circleFilter);
  }
  for (const layerId of stack.roundedResting) {
    trySetLayerFilter(map, layerId, roundedFilter);
  }
}

/** Shape filters after layer heal — keep the selected feature off the resting stack. */
export function syncFloatingBadgeStackFilters(
  map: MapInstance,
  ids: SharedPointLayerIds,
  promoteId = 'id'
): void {
  syncFloatingBadgeStackShapeFilters(map, ids);
  const featureId = getSharedPointSelection(map, ids.sourceId)?.featureId ?? null;
  if (featureId == null) return;
  syncSharedPointSelectedLayerFilter(map, {
    pointLayerId: ids.pointLayerId,
    glowLayerId: ids.glowLayerId,
    promoteId,
    featureId,
  });
}

export type EnsureFloatingBadgeMarkerStackOptions = {
  map: MapInstance;
  ids: SharedPointLayerIds;
  paint: ApplySharedPointPaintOptions;
  setupCircleChrome: (
    map: MapInstance,
    ids: SharedPointLayerIds,
    paint: ApplySharedPointPaintOptions
  ) => Promise<void>;
};

/** Mount circle + rounded stacks, glyphs, and shape filters for the floating-badge factory. */
export async function ensureFloatingBadgeMarkerStack(
  options: EnsureFloatingBadgeMarkerStackOptions
): Promise<void> {
  const { map, ids, paint, setupCircleChrome } = options;
  if (!paint.selectionGroundBadge) return;

  await setupCircleChrome(map, ids, paint);

  const roundedChrome = {
    ...buildFloatingBadgeRoundedChromeOptions(ids, paint),
    pointIconTranslate: paint.pointTranslate,
    ringColorExpression: paint.strokeColorExpression,
    outerColorExpression: sharedPointRestingRoundedOuterColor(paint),
    shadowRadius: paint.glowRadiusExpression,
    shadowOpacity: paint.glowOpacity,
    shadowTranslate: paint.glowTranslate,
  };

  ensureSharedPointRoundedRectChromeLayers(map, roundedChrome);
  ensureFloatingBadgeSelectionChrome(map, ids, paint);
  ensureSharedPointBadgeIconLayers(map, {
    sourceId: ids.sourceId,
    pointLayerId: ids.pointLayerId,
    pointIconTranslate: paint.pointTranslate,
    selectionIconTranslate: paint.selectedTranslate,
  });
  raiseSharedPointBadgeIconLayersOnTop(map, ids.pointLayerId);
  syncFloatingBadgeStackFilters(map, ids);
  applySharedPointRoundedRectChromePaint(map, ids.pointLayerId, paint);

  if (!map.setPaintProperty) return;
  for (const layerId of [
    ids.pointLayerId,
    `${ids.pointLayerId}-outer-stroke`,
    `${ids.pointLayerId}-glass`,
    ...buildFloatingBadgeStack(ids).roundedResting,
  ]) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      if (paint.pointTranslateAnchor) {
        const prop = layerId.includes('rounded') || layerId.includes('badge-icon')
          ? 'icon-translate-anchor'
          : 'circle-translate-anchor';
        map.setPaintProperty(layerId, prop, paint.pointTranslateAnchor);
      }
    } catch {
      /* ignore */
    }
  }
}

/** Paint sync for both geometry stacks from one marker paint config. */
export function applyFloatingBadgeMarkerStackPaint(
  map: MapInstance,
  ids: SharedPointLayerIds,
  paint: ApplySharedPointPaintOptions,
  applyCirclePaint: (map: MapInstance, paint: ApplySharedPointPaintOptions) => void
): void {
  applyCirclePaint(map, paint);
  applySharedPointRoundedRectChromePaint(map, ids.pointLayerId, paint);
  reapplyFloatingBadgeSelectionChromeIfActive(map, ids, paint);
}