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
} from './marker-shape';

export type FloatingBadgeStack = {
  /** Ground shadow — all marker shapes. */
  shadow: readonly string[];
  /** Circle floating badge (places). */
  circleBody: readonly string[];
  /** Rounded-rect chrome on the main source (resources). */
  roundedResting: readonly string[];
  /** Circle selection chrome (places). */
  selectionCircle: readonly string[];
  /** Rounded-rect selection chrome (resources). */
  selectionRounded: readonly string[];
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
    circleBody: circleBody.includes(glassId) ? circleBody : [...circleBody, glassId],
    roundedResting,
    selectionCircle,
    selectionRounded,
    interaction,
    all,
  };
}

/** Shape split — shadow layers are never circle-scoped. */
export function syncFloatingBadgeStackShapeFilters(
  map: MapInstance,
  ids: SharedPointLayerIds
): void {
  if (!map.setFilter) return;
  const stack = buildFloatingBadgeStack(ids);
  const circleFilter = sharedPointCircleBodyFilter();
  const roundedFilter = sharedPointRoundedRectBodyFilter();

  for (const layerId of stack.circleBody) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setFilter(layerId, circleFilter as never);
    } catch {
      /* provider */
    }
  }
  for (const layerId of stack.roundedResting) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setFilter(layerId, roundedFilter as never);
    } catch {
      /* provider */
    }
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
    coreColorExpression: paint.pointColorExpression,
    ringColorExpression: paint.strokeColorExpression,
    outerColorExpression: paint.outerStrokeColorExpression,
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