import type { MapInstance } from '../../providers/types';
import { replaceMapStyleImage, STYLE_IMAGE_PIXEL_RATIO } from '../map-surface/map-style-images';
import { SHARED_POINT_BADGE_ICON_PROPERTY } from './shared-point-badge-constants';
import { sharedPointBadgeIconSizeExpression } from './shared-point-badge-icon-sizing';
import { sharedPointSelectionFrontLayerIds } from '../markers/marker-shape';
import {
  SHARED_POINT_FLOATING_BADGE_FILL,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeTranslateExpression,
  sharedPointGlassLayerId,
  sharedPointHoverBadgeLayerId,
  sharedPointHoverBadgeOuterLayerId,
} from './shared-point-paint';

export { SHARED_POINT_BADGE_ICON_PROPERTY };

export type BadgeIconImageLike = {
  width: number;
  height: number;
  data: ArrayBufferView | ImageData;
};

export type RegisterBadgeIconImageOptions = {
  sdf?: boolean;
  pixelRatio?: number;
};

export function sharedPointPointBadgeIconLayerId(pointLayerId: string): string {
  return `${pointLayerId}-badge-icon`;
}

export function sharedPointSelectionBadgeIconLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge-icon`;
}

export {
  SHARED_POINT_BADGE_ICON_DISK_FILL,
  sharedPointBadgeIconSizeExpression,
  sharedPointBadgeIconSizeForGlyphDiskExpression,
} from './shared-point-badge-icon-sizing';

/** Circle layers that must sit under the badge symbol glyph. */
export function sharedPointBadgeDiskLayerIds(pointLayerId: string): string[] {
  return [
    `${pointLayerId}-selection-shadow`,
    `${pointLayerId}-selection-badge-outer`,
    `${pointLayerId}-selection-badge`,
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointGlassLayerId(pointLayerId),
    `${pointLayerId}-outer-stroke`,
    pointLayerId,
  ];
}

/** Glyphs above their badge disks; the selected marker above every resting marker. */
export function raiseSharedPointBadgeIconLayersOnTop(
  map: MapInstance,
  pointLayerId: string
): void {
  const target = map as { moveLayer?: MoveLayer };
  if (typeof target.moveLayer !== 'function') return;
  const moveLayer = target.moveLayer.bind(map);

  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
  const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
  const anchor = map.getLayer?.(selectionIconId)
    ? selectionIconId
    : map.getLayer?.(pointIconId)
      ? pointIconId
      : null;
  if (anchor) raiseBadgeIconsAboveDisks(map, moveLayer, pointLayerId, anchor);
  raiseSelectionToFront(map, moveLayer, pointLayerId);
}

type MoveLayer = (id: string, beforeId?: string) => void;

function raiseBadgeIconsAboveDisks(
  map: MapInstance,
  moveLayer: MoveLayer,
  pointLayerId: string,
  anchor: string
): void {
  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);

  for (const diskId of sharedPointBadgeDiskLayerIds(pointLayerId)) {
    if (diskId === anchor || !map.getLayer?.(diskId)) continue;
    try {
      moveLayer(diskId, anchor);
    } catch {
      /* style swap */
    }
  }

  if (map.getLayer?.(pointIconId)) {
    try {
      moveLayer(pointIconId);
    } catch {
      /* style swap */
    }
  }
}

/** Selected marker always draws above every resting marker. */
function raiseSelectionToFront(map: MapInstance, moveLayer: MoveLayer, pointLayerId: string): void {
  for (const layerId of sharedPointSelectionFrontLayerIds(pointLayerId)) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      moveLayer(layerId);
    } catch {
      /* style swap */
    }
  }
}

const badgeIconFilter: unknown[] = [
  'all',
  ['has', SHARED_POINT_BADGE_ICON_PROPERTY],
  ['!=', ['to-string', ['get', SHARED_POINT_BADGE_ICON_PROPERTY]], ''],
];

function buildBadgeIconLayerSpec(input: {
  id: string;
  source: string;
  iconTranslate?: [number, number] | unknown[];
  iconColor?: string;
}): Record<string, unknown> {
  const iconTranslate =
    input.iconTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);
  const paint: Record<string, unknown> = {
    'icon-opacity': 1,
    'icon-translate': iconTranslate,
    'icon-translate-anchor': 'viewport',
  };
  if (input.iconColor) paint['icon-color'] = input.iconColor;
  return {
    id: input.id,
    type: 'symbol',
    source: input.source,
    filter: badgeIconFilter,
    layout: {
      'icon-image': ['get', SHARED_POINT_BADGE_ICON_PROPERTY],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'center',
      'icon-pitch-alignment': 'viewport',
      'icon-rotation-alignment': 'viewport',
      'icon-size': sharedPointBadgeIconSizeExpression(),
    },
    paint,
  };
}

export function registerBadgeIconImage(
  map: MapInstance,
  id: string,
  image: BadgeIconImageLike,
  options?: RegisterBadgeIconImageOptions
): void {
  const key = id.trim();
  if (!key) return;
  const pixelRatio = options?.pixelRatio ?? STYLE_IMAGE_PIXEL_RATIO;
  const addOpts =
    options?.sdf === true
      ? { sdf: true as const, pixelRatio }
      : { pixelRatio };
  replaceMapStyleImage(map, key, image, addOpts);
}

export type EnsureSharedPointBadgeIconLayersOptions = {
  sourceId: string;
  pointLayerId: string;
  /** Resting badge float translate (zoom expression). */
  pointIconTranslate?: [number, number] | unknown[];
  /** Selection badge lift translate (zoom expression or screen offset). */
  selectionIconTranslate?: [number, number] | unknown[];
};

export function ensureSharedPointBadgeIconLayers(
  map: MapInstance,
  options: EnsureSharedPointBadgeIconLayersOptions
): void {
  const { sourceId, pointLayerId } = options;
  const selectionSourceId = `${sourceId}-selection`;
  const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
  const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);

  const pointTranslate =
    options.pointIconTranslate ?? sharedPointFloatingBadgeTranslateExpression(0);
  const selectionTranslate = options.selectionIconTranslate ?? pointTranslate;

  if (map.getSource?.(sourceId) && !map.getLayer?.(pointIconId) && map.addLayer) {
    try {
      map.addLayer(
        buildBadgeIconLayerSpec({
          id: pointIconId,
          source: sourceId,
          iconTranslate: pointTranslate,
          iconColor: SHARED_POINT_FLOATING_BADGE_FILL,
        }) as never
      );
    } catch {
      /* ignore */
    }
  }

  if (map.getSource?.(selectionSourceId) && !map.getLayer?.(selectionIconId) && map.addLayer) {
    try {
      map.addLayer(
        buildBadgeIconLayerSpec({
          id: selectionIconId,
          source: selectionSourceId,
          iconTranslate: selectionTranslate,
        }) as never
      );
    } catch {
      /* ignore */
    }
  }

  syncBadgeIconTranslate(map, pointLayerId);
  raiseSharedPointBadgeIconLayersOnTop(map, pointLayerId);
}

function selectionBadgeCircleLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge`;
}

/** Match glyph lift to the live selection badge `circle-translate` (not ground anchor). */
export function syncBadgeIconTranslate(map: MapInstance, pointLayerId: string): void {
  const badgeId = selectionBadgeCircleLayerId(pointLayerId);
  const getPaint = (map as { getPaintProperty?: (id: string, prop: string) => unknown })
    .getPaintProperty;
  if (!map.getLayer?.(badgeId) || !getPaint) return;
  try {
    const translate = getPaint(badgeId, 'circle-translate');
    if (translate != null) {
      syncSelectionBadgeIconTranslate(map, pointLayerId, translate as [number, number] | unknown[]);
    }
  } catch {
    /* style swap */
  }
}

/** Keep selection glyph lift in sync with circle badge translate animation. */
export function syncSelectionBadgeIconTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  const iconLayerId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
  if (!map.getLayer?.(iconLayerId)) return;
  const screenTranslate = sharedPointFloatingBadgeNormalizeViewportTranslate(translate);
  try {
    map.setPaintProperty(iconLayerId, 'icon-translate-anchor', 'viewport');
    map.setPaintProperty(iconLayerId, 'icon-translate', screenTranslate);
  } catch {
    /* style swap */
  }
}

/** @deprecated Use `syncBadgeIconTranslate`. */
export const healSharedPointBadgeIconTranslate = syncBadgeIconTranslate;