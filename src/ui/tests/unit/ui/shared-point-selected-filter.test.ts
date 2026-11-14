import { describe, expect, it, vi } from 'vitest';
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

    const expected = sharedPointExcludeFeatureIdFilter('venueId', 'v1');
    expect(setFilter).toHaveBeenCalledWith('pts', expected);
    expect(setFilter).toHaveBeenCalledWith('pts-outer-stroke', expected);
    expect(setFilter).toHaveBeenCalledWith('pts-glow', expected);
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

    expect(setFilter).toHaveBeenCalledWith('pts', null);
  });
});
