import type { MapInstance } from '../../providers/types';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import {
  resolveFloatingBadgeSelectionAccentColor,
  sharedPointFloatingBadgePaintExpressions,
} from '../paint/shared-point-paint';
import { floatingBadgeSelectionAccentFromProperties } from './marker-selection-chrome';
import { getSharedPointRelatedSourceIds } from '../shared-points/shared-point-sync';
import type { MarkerBodyShape } from './marker-shape';
import { createMarker, type MarkerPreset } from './factory';
import { buildFloatingBadgeStack } from './marker-stack';
import {
  applyFloatingBadgeSelectionChrome,
  floatingBadgeBodyShapeFromProperties,
  type FloatingBadgeSelectionChromeOptions,
} from './marker-selection-chrome';
import { SHARED_POINT_BADGE_ICON_PROPERTY } from '../paint/shared-point-badge-constants';

export type BadgeKind = 'place' | 'resource';

export function sharedPointBadgeVariantFromProperties(
  properties: Record<string, unknown> | null | undefined
): BadgeKind {
  return floatingBadgeBodyShapeFromProperties(properties) === 'rounded-rect' ? 'resource' : 'place';
}

export function sharedPointBadgeShapeFromProperties(
  properties: Record<string, unknown> | null | undefined
): MarkerBodyShape {
  return floatingBadgeBodyShapeFromProperties(properties);
}

function selectionChromeForVariant(
  variant: BadgeKind
): Pick<FloatingBadgeSelectionChromeOptions, 'shape'> {
  return { shape: variant === 'resource' ? 'rounded-rect' : 'circle' };
}

export const badgePreset: MarkerPreset<BadgeKind, SharedPointLayerIds, ApplySharedPointPaintOptions> =
  {
    presetId: 'floating-badge',
    inventory: {
      layerStack: (ids) => [...buildFloatingBadgeStack(ids).all],
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
      variantFrom: (properties) => sharedPointBadgeVariantFromProperties(properties),
      shapeFrom: (properties) => floatingBadgeBodyShapeFromProperties(properties),
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
        applyFloatingBadgeSelectionChrome(map, ids.pointLayerId, {
          accentColor: state.accentColor,
          ...selectionChromeForVariant(state.variant),
        });
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

export type SyncBadgeChromeOptions = {
  keyColor: string;
  properties?: Record<string, unknown> | null;
  /** @deprecated Pass `properties` — shape comes from the marker factory. */
  badgeGlyph?: boolean;
};

export function syncBadgeChrome(
  map: MapInstance,
  pointLayerId: string,
  options: SyncBadgeChromeOptions
): void {
  const shape =
    options.properties != null
      ? floatingBadgeBodyShapeFromProperties(options.properties)
      : options.badgeGlyph
        ? 'rounded-rect'
        : 'circle';
  const fallback = options.keyColor.trim() || '#888888';
  const props = options.properties ?? null;
  const accent =
    props != null
      ? floatingBadgeSelectionAccentFromProperties(props, fallback)
      : resolveFloatingBadgeSelectionAccentColor(null, fallback);
  applyFloatingBadgeSelectionChrome(map, pointLayerId, {
    accentColor: accent,
    shape,
  });
}

export { SHARED_POINT_BADGE_ICON_PROPERTY };