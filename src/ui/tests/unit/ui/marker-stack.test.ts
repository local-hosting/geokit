import { describe, expect, it, vi } from 'vitest';
import {
  buildFloatingBadgeStack,
  floatingBadgeRoundedRestingLayerIds,
  syncFloatingBadgeStackShapeFilters,
} from '../../../src/utils/markers/marker-stack';
import { sharedPointCircleBodyFilter, sharedPointRoundedRectBodyFilter } from '../../../src/utils/markers/marker-shape';

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
    expect(setFilter).not.toHaveBeenCalledWith(
      'canvas-places-glow',
      sharedPointCircleBodyFilter()
    );
  });
});