import { describe, expect, it, vi } from 'vitest';
import {
  buildFloatingBadgeStack,
  floatingBadgeRoundedRestingLayerIds,
  syncFloatingBadgeStackFilters,
  syncFloatingBadgeStackShapeFilters,
} from '../../../src/utils/markers/marker-stack';
import { sharedPointCircleBodyFilter, sharedPointRoundedRectBodyFilter } from '../../../src/utils/markers/marker-shape';
import { sharedPointExcludeFeatureIdFilter } from '../../../src/utils/paint/shared-point-paint';
import { setSharedPointSelection } from '../../../src/utils/layers/styles/shared-point-layers';

describe('buildFloatingBadgeStack', () => {
  const ids = {
    sourceId: 'canvas-places',
    pointLayerId: 'canvas-places-point',
    glowLayerId: 'canvas-places-glow',
  };

  it('lists shared shadow, circle body, and rounded body layers', () => {
    const stack = buildFloatingBadgeStack(ids);
    expect(stack.shadow).toEqual(['canvas-places-glow', 'canvas-places-glow-hover']);
    expect(stack.circleBody).toContain('canvas-places-point');
    expect(stack.circleBody).toContain('canvas-places-point-outer-stroke');
    expect(stack.roundedResting).toEqual(floatingBadgeRoundedRestingLayerIds(ids.pointLayerId));
    expect(stack.all).toEqual(
      expect.arrayContaining([
        ...stack.shadow,
        ...stack.circleBody,
        ...stack.roundedResting,
        ...stack.selectionRounded,
      ])
    );
  });

  it('applies shape filters per stack slice', () => {
    const setFilter = vi.fn();
    const map = {
      getLayer: (id: string) =>
        id.startsWith('canvas-places') || id.includes('rounded') ? {} : undefined,
      setFilter,
    };

    syncFloatingBadgeStackShapeFilters(map as never, ids);

    expect(setFilter).toHaveBeenCalledWith(
      'canvas-places-point',
      sharedPointCircleBodyFilter()
    );
    expect(setFilter).toHaveBeenCalledWith(
      'canvas-places-point-rounded-body',
      sharedPointRoundedRectBodyFilter()
    );
    // Ground glow is shape-agnostic (soft circle cast under every marker).
    expect(setFilter).toHaveBeenCalledWith('canvas-places-glow', null);
    expect(setFilter).toHaveBeenCalledWith('canvas-places-glow-hover', null);
  });

  it('re-applies selected feature exclude after shape filters (layer heal)', () => {
    const setFilter = vi.fn();
    const map = {
      getLayer: (id: string) =>
        id.startsWith('canvas-places') || id.includes('rounded') ? {} : undefined,
      setFilter,
      getSource: () => ({}),
      setFeatureState: vi.fn(),
    };

    setSharedPointSelection(
      map as never,
      ids.sourceId,
      { featureId: 'buffalo-harbor', lngLat: { lng: -78.87, lat: 42.88 } },
      {
        pointLayerId: ids.pointLayerId,
        glowLayerId: ids.glowLayerId,
        promoteId: 'mapPromoteId',
        selectionGroundBadge: true,
      }
    );
    setFilter.mockClear();

    syncFloatingBadgeStackFilters(map as never, ids, 'mapPromoteId');

    const exclude = sharedPointExcludeFeatureIdFilter('mapPromoteId', 'buffalo-harbor');
    expect(setFilter).toHaveBeenCalledWith('canvas-places-point', [
      'all',
      sharedPointCircleBodyFilter(),
      exclude,
    ]);
  });
});