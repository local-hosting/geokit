import { describe, expect, it, vi } from 'vitest';

import {
  ensureSharedPointRoundedRectChromeLayers,
  ensureSharedPointSelectionRoundedRectChromeLayers,
} from '../../../src/utils/paint/shared-point-rounded-body';
import { GK_ROUNDED_RECT_SHADOW_IMAGE_ID } from '../../../src/utils/paint/shared-point-rounded-shadow';
import {
  sharedPointCircleBodyFilter,
  sharedPointCombineLayerFilters,
} from '../../../src/utils/markers/marker-shape';
import {
  sharedPointExcludeFeatureIdFilter,
  sharedPointFloatingBadgePaintExpressions,
  syncSharedPointSelectedLayerFilter,
} from '../../../src/utils/shared-point-paint';

type LayerSpec = { id: string; paint: Record<string, unknown>; layout: Record<string, unknown> };

const pointLayerId = 'canvas-places-point';
const sourceId = 'canvas-places';

function fakeMap(sources: string[]) {
  const added: LayerSpec[] = [];
  const map = {
    getSource: (id: string) => (sources.includes(id) ? {} : undefined),
    getLayer: () => undefined,
    getCanvas: () => ({ width: 100, height: 100 }),
    hasImage: () => true,
    addLayer: vi.fn((spec: LayerSpec) => added.push(spec)),
  };
  return { map, added };
}

describe('rounded-rect uses soft circle glow — no hard square sprite shadow', () => {
  it('selected: does not add a rounded-rect shadow sprite layer', () => {
    const { map, added } = fakeMap([`${sourceId}-selection`]);
    ensureSharedPointSelectionRoundedRectChromeLayers(map as never, {
      sourceId,
      pointLayerId,
      fallbackColor: '#908ac7',
    });
    expect(added.find((spec) => spec.id === `${pointLayerId}-selection-rounded-shadow`)).toBeUndefined();
    expect(added.some((spec) => spec.layout?.['icon-image'] === GK_ROUNDED_RECT_SHADOW_IMAGE_ID)).toBe(
      false
    );
  });

  it('resting: does not add a rounded-rect shadow sprite layer', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#908ac7',
      themeElement: null,
    });
    const setLayoutProperty = vi.fn();
    const { map, added } = fakeMap([sourceId]);
    const mapWithHide = { ...map, setLayoutProperty, getLayer: (id: string) =>
      id.endsWith('-rounded-shadow') ? {} : undefined,
    };
    ensureSharedPointRoundedRectChromeLayers(mapWithHide as never, {
      sourceId,
      pointLayerId,
      fallbackColor: '#908ac7',
      pointIconTranslate: paint.pointTranslate,
      shadowRadius: paint.glowRadiusExpression,
      shadowOpacity: paint.glowOpacity,
      shadowTranslate: paint.glowTranslate,
    });

    expect(added.find((spec) => spec.id === `${pointLayerId}-rounded-shadow`)).toBeUndefined();
    expect(setLayoutProperty).toHaveBeenCalledWith(
      `${pointLayerId}-rounded-shadow`,
      'visibility',
      'none'
    );
  });

  it('moves the selected cast onto selection-shadow (resting glow yields under that pin)', () => {
    const setFilter = vi.fn();
    const map = { getLayer: () => ({}), setFilter };
    syncSharedPointSelectedLayerFilter(map, {
      pointLayerId,
      glowLayerId: 'canvas-places-glow',
      promoteId: 'mapPromoteId',
      featureId: 'dock-crane',
    });
    const exclude = sharedPointExcludeFeatureIdFilter('mapPromoteId', 'dock-crane')!;
    // Resting glow drops the selected pin; selection-shadow paints the clear under cast.
    expect(setFilter).toHaveBeenCalledWith('canvas-places-glow', exclude);
    expect(setFilter).not.toHaveBeenCalledWith(
      'canvas-places-glow',
      sharedPointCombineLayerFilters(sharedPointCircleBodyFilter(), exclude)
    );
  });
});
