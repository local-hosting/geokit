import { describe, expect, it, vi } from 'vitest';

import {
  buildFloatingBadgeStack,
  setFloatingBadgeSelectionLift,
} from '../../../src/utils/markers/marker-stack';

const ids = {
  sourceId: 'canvas-places',
  pointLayerId: 'canvas-places-point',
  glowLayerId: 'canvas-places-glow',
};

function fakeMap() {
  const types = new Map<string, string>();
  for (const id of buildFloatingBadgeStack(ids).all) {
    types.set(id, id.includes('rounded') || id.endsWith('-icon') ? 'symbol' : 'circle');
  }
  const setPaintProperty = vi.fn();
  return {
    map: {
      getLayer: (id: string) => (types.has(id) ? { id, type: types.get(id) } : undefined),
      setPaintProperty,
    },
    setPaintProperty,
  };
}

describe('setFloatingBadgeSelectionLift', () => {
  it('moves every selected badge layer from the stack, whatever its shape', () => {
    const { map, setPaintProperty } = fakeMap();
    setFloatingBadgeSelectionLift(map as never, ids, [0, 3]);

    for (const id of buildFloatingBadgeStack(ids).selectionLift) {
      const prop = map.getLayer(id)!.type === 'circle' ? 'circle' : 'icon';
      expect(setPaintProperty).toHaveBeenCalledWith(id, `${prop}-translate`, [0, 3]);
      expect(setPaintProperty).toHaveBeenCalledWith(id, `${prop}-translate-anchor`, 'viewport');
    }
  });

  it('covers both shapes and the glyph, and leaves shadows grounded', () => {
    const lift = buildFloatingBadgeStack(ids).selectionLift;
    expect(lift).toEqual(
      expect.arrayContaining([
        'canvas-places-point-selection-badge',
        'canvas-places-point-selection-badge-outer',
        'canvas-places-point-selection-rounded-outer',
        'canvas-places-point-selection-rounded-ring',
        'canvas-places-point-selection-rounded-body',
        'canvas-places-point-selection-badge-icon',
      ])
    );
    expect(lift).not.toContain('canvas-places-point-selection-shadow');
    expect(lift).not.toContain('canvas-places-point-selection-rounded-shadow');
  });
});
