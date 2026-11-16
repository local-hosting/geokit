import type { MapInstance } from '../../providers/types';
import { SHARED_POINT_BADGE_ICON_PROPERTY } from '../paint/shared-point-badge-constants';
import {
  sharedPointBadgeIconSizeExpression,
  sharedPointBadgeIconSizeForGlyphDiskExpression,
} from '../paint/shared-point-badge-icon-sizing';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import {
  resolveSharedPointFloatingBadgeTokens,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointGlassLayerId,
  sharedPointSelectionBadgeLayerId,
  sharedPointSelectionBadgeOuterLayerId,
} from '../paint/shared-point-paint';
import {
  getSharedPointRelatedLayerIds,
  getSharedPointRelatedSourceIds,
} from '../shared-points/shared-point-sync';
import { createMarker, type MarkerPreset } from './factory';

export type BadgeKind = 'place' | 'resource';

function badgeLayers(ids: SharedPointLayerIds): string[] {
  const glassId = sharedPointGlassLayerId(ids.pointLayerId);
  const stack = [...getSharedPointRelatedLayerIds(ids)];
  if (stack.includes(glassId)) return stack;
  const i = stack.indexOf(`${ids.pointLayerId}-outer-stroke`);
  stack.splice(i >= 0 ? i + 1 : 1, 0, glassId);
  return stack;
}

function setProps(
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

function applyChrome(
  map: MapInstance,
  pointLayerId: string,
  accentColor: string,
  variant: BadgeKind
): void {
  const badgeId = sharedPointSelectionBadgeLayerId(pointLayerId);
  if (!map.getLayer?.(badgeId)) return;

  const tokens = resolveSharedPointFloatingBadgeTokens();
  const badgeOuterId = sharedPointSelectionBadgeOuterLayerId(pointLayerId);
  const iconLayerId = `${pointLayerId}-selection-badge-icon`;
  const ringWidth = sharedPointFloatingBadgeRingWidthExpression(tokens.coloredRingWidth);
  const selectedRadius = sharedPointFloatingBadgeSelectedRadiusExpression();
  const shared: (readonly [string, string, unknown])[] = [
    [badgeId, 'circle-color', accentColor],
  ];

  if (variant === 'resource') {
    const r = sharedPointFloatingBadgeOuterStrokeRadius(selectedRadius, ringWidth);
    setProps(
      map,
      [
        ...shared,
        [badgeId, 'circle-radius', r],
        [badgeId, 'circle-stroke-width', 0],
        [badgeId, 'circle-stroke-opacity', 0],
        [badgeId, 'circle-stroke-color', accentColor],
        [badgeOuterId, 'circle-opacity', 0],
        [badgeOuterId, 'circle-stroke-opacity', 0],
      ],
      [[iconLayerId, 'icon-size', sharedPointBadgeIconSizeForGlyphDiskExpression()]]
    );
    return;
  }

  setProps(
    map,
    [
      ...shared,
      [badgeId, 'circle-radius', selectedRadius],
      [badgeId, 'circle-stroke-width', ringWidth],
      [badgeId, 'circle-stroke-opacity', 1],
      [badgeId, 'circle-stroke-color', tokens.fill],
      [badgeOuterId, 'circle-color', accentColor],
      [badgeOuterId, 'circle-stroke-color', accentColor],
      [badgeOuterId, 'circle-opacity', 1],
      [badgeOuterId, 'circle-stroke-opacity', 1],
    ],
    [[iconLayerId, 'icon-size', sharedPointBadgeIconSizeExpression()]]
  );
}

export const badgePreset: MarkerPreset<BadgeKind, SharedPointLayerIds, ApplySharedPointPaintOptions> =
  {
    presetId: 'floating-badge',
    inventory: {
      layerStack: badgeLayers,
      sourceStack: (ids) => getSharedPointRelatedSourceIds(ids.sourceId),
    },
    paint: {
      build: (ids, options) =>
        ({
          ids,
          ...sharedPointFloatingBadgePaintExpressions({
            fallbackColor: String(options.fallbackAccent ?? '#888888'),
            colorProperty:
              typeof options.colorProperty === 'string' ? options.colorProperty : undefined,
            themeElement:
              options.themeElement instanceof Element ? options.themeElement : undefined,
          }),
        }) as ApplySharedPointPaintOptions,
    },
    features: {
      variantFrom: (properties) => {
        const icon = properties?.[SHARED_POINT_BADGE_ICON_PROPERTY];
        return typeof icon === 'string' && icon.trim() ? 'resource' : 'place';
      },
      accentFrom: (properties, fallbackAccent) => {
        const resting =
          typeof properties?._colorResting === 'string' ? properties._colorResting.trim() : '';
        const color = typeof properties?._color === 'string' ? properties._color.trim() : '';
        return resting || color || fallbackAccent.trim() || '#888888';
      },
    },
    states: {
      apply(map, ids, state) {
        if (state.phase !== 'selected') return;
        applyChrome(map, ids.pointLayerId, state.accentColor, state.variant);
      },
    },
  };

export function createBadgeMarker(options: {
  ids: SharedPointLayerIds;
  fallbackColor: string;
  colorProperty?: string;
  themeElement?: Element | null;
}) {
  return createMarker(badgePreset, {
    ids: options.ids,
    fallbackAccent: options.fallbackColor,
    paintOptions: {
      colorProperty: options.colorProperty,
      themeElement: options.themeElement ?? undefined,
    },
  });
}

export function syncBadgeChrome(
  map: MapInstance,
  pointLayerId: string,
  options: { keyColor: string; badgeGlyph: boolean }
): void {
  applyChrome(map, pointLayerId, options.keyColor, options.badgeGlyph ? 'resource' : 'place');
}

