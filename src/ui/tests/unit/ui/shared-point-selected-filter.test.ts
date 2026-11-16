import { describe, expect, it, vi } from 'vitest';
import { sharedPointCircleBodyFilter } from '../../../src/utils/markers/marker-shape';
import {
  sharedPointExcludeFeatureIdFilter,
  syncSharedPointSelectedLayerFilter,
} from '../../../src/utils/paint/shared-point-paint';

describe('syncSharedPointSelectedLayerFilter', () => {
  it('filters floating badge + resting glow so the selection source owns the grounded look', () => {
    const setFilter = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) =>
        id === 'pts' || id === 'pts-outer-stroke' || id === 'pts-glow' ? {} : undefined
      ),
      setFilter,
    };

    syncSharedPointSelectedLayerFilter(map as never, {
      pointLayerId: 'pts',
      glowLayerId: 'pts-glow',
      promoteId: 'venueId',
      featureId: 'v1',
    });

    const exclude = sharedPointExcludeFeatureIdFilter('venueId', 'v1');
    const circleShape = sharedPointCircleBodyFilter();
    expect(setFilter).toHaveBeenCalledWith('pts', ['all', circleShape, exclude]);
    expect(setFilter).toHaveBeenCalledWith('pts-outer-stroke', ['all', circleShape, exclude]);
    expect(setFilter).toHaveBeenCalledWith('pts-glow', ['all', circleShape, exclude]);
  });

  it('clears filters when selection is empty', () => {
    const setFilter = vi.fn();
    const map = {
      getLayer: vi.fn((id: string) => (id === 'pts' ? {} : undefined)),
      setFilter,
    };

    syncSharedPointSelectedLayerFilter(map as never, {
      pointLayerId: 'pts',
      promoteId: 'venueId',
      featureId: null,
    });

    expect(setFilter).toHaveBeenCalledWith('pts', sharedPointCircleBodyFilter());
  });
});
