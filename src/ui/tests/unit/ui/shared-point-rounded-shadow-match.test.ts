import { describe, expect, it, vi } from 'vitest';

import {
  ensureSharedPointRoundedRectChromeLayers,
  ensureSharedPointSelectionRoundedRectChromeLayers,
} from '../../../src/utils/paint/shared-point-rounded-body';
import {
  GK_ROUNDED_RECT_SHADOW_IMAGE_ID,
  sharedPointRoundedShadowIconSizeExpression,
} from '../../../src/utils/paint/shared-point-rounded-shadow';
import {
  sharedPointCircleBodyFilter,
  sharedPointCombineLayerFilters,
  sharedPointRoundedRectBodyFilter,
} from '../../../src/utils/markers/marker-shape';
import {
  resolveSharedPointFloatingBadgeTokens,
  scaleInterpolateRadiusStops,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  sharedPointExcludeFeatureIdFilter,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointFloatingBadgeShadowRadiusExpression,
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

describe('rounded-rect shadow matches the circle shadow', () => {
  it('selected: same radius, opacity, and offset as the circle selection shadow', () => {
    const { map, added } = fakeMap([`${sourceId}-selection`]);
    ensureSharedPointSelectionRoundedRectChromeLayers(map as never, {
      sourceId,
      pointLayerId,
      fallbackColor: '#908ac7',
    });
    const tokens = resolveSharedPointFloatingBadgeTokens();
    const circleRadius = scaleInterpolateRadiusStops(
      sharedPointFloatingBadgeShadowRadiusExpression(undefined, tokens.shadowRadiusPad),
      tokens.selectedShadowScale
    );

    const shadow = added.find((spec) => spec.id === `${pointLayerId}-selection-rounded-shadow`)!;
    expect(added.indexOf(shadow)).toBe(0);
    expect(shadow.layout['icon-image']).toBe(GK_ROUNDED_RECT_SHADOW_IMAGE_ID);
    expect(shadow.layout['icon-size']).toEqual(
      sharedPointRoundedShadowIconSizeExpression(circleRadius)
    );
    expect(shadow.paint['icon-opacity']).toBe(tokens.selectedShadowOpacity);
    expect(shadow.paint['icon-translate']).toEqual(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE);
    expect(shadow.paint['icon-translate-anchor']).toBe('viewport');
  });

  it('resting: rounded shadow uses the glow radius, opacity curve, and offset', () => {
    const paint = sharedPointFloatingBadgePaintExpressions({
      fallbackColor: '#908ac7',
      themeElement: null,
    });
    const { map, added } = fakeMap([sourceId]);
    ensureSharedPointRoundedRectChromeLayers(map as never, {
      sourceId,
      pointLayerId,
      fallbackColor: '#908ac7',
      pointIconTranslate: paint.pointTranslate,
      shadowRadius: paint.glowRadiusExpression,
      shadowOpacity: paint.glowOpacity,
      shadowTranslate: paint.glowTranslate,
    });

    const shadow = added.find((spec) => spec.id === `${pointLayerId}-rounded-shadow`)!;
    expect(added.indexOf(shadow)).toBe(0);
    expect(shadow.layout['icon-image']).toBe(GK_ROUNDED_RECT_SHADOW_IMAGE_ID);
    expect(shadow.layout['icon-size']).toEqual(
      sharedPointRoundedShadowIconSizeExpression(paint.glowRadiusExpression)
    );
    expect(shadow.paint['icon-opacity']).toEqual(paint.glowOpacity);
    expect(shadow.paint['icon-translate']).toEqual(paint.glowTranslate);
  });

  it('keeps the circle glow off rounded-rect markers and hides the selected rounded shadow', () => {
    const setFilter = vi.fn();
    const map = { getLayer: () => ({}), setFilter };
    syncSharedPointSelectedLayerFilter(map, {
      pointLayerId,
      glowLayerId: 'canvas-places-glow',
      promoteId: 'mapPromoteId',
      featureId: 'dock-crane',
    });
    const exclude = sharedPointExcludeFeatureIdFilter('mapPromoteId', 'dock-crane')!;
    expect(setFilter).toHaveBeenCalledWith(
      'canvas-places-glow',
      sharedPointCombineLayerFilters(sharedPointCircleBodyFilter(), exclude)
    );
    expect(setFilter).toHaveBeenCalledWith(
      `${pointLayerId}-rounded-shadow`,
      sharedPointCombineLayerFilters(sharedPointRoundedRectBodyFilter(), exclude)
    );
  });
});
