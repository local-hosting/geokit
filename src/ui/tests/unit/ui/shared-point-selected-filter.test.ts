import { describe, expect, it, vi } from 'vitest';
import {
  sharedPointCircleBodyFilter,
  sharedPointCombineLayerFilters,
} from '../../../src/utils/markers/marker-shape';
import {
  sharedPointExcludeFeatureIdFilter,
  syncSharedPointSelectedLayerFilter,
} from '../../../src/utils/paint/shared-point-paint';

describe('syncSharedPointSelectedLayerFilter', () => {
  it('filters the selected feature off resting badge bodies (selection source draws settle)', () => {
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
    const circleFilter = sharedPointCombineLayerFilters(sharedPointCircleBodyFilter(), exclude);
    expect(setFilter).toHaveBeenCalledWith('pts', circleFilter);
    expect(setFilter).toHaveBeenCalledWith('pts-outer-stroke', circleFilter);
    expect(setFilter).toHaveBeenCalledWith('pts-glow', exclude);
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
