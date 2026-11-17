import { describe, expect, it, vi } from 'vitest';
import { sharedPointCircleBodyFilter } from '../../../src/utils/markers/marker-shape';
import {
  sharedPointExcludeFeatureIdFilter,
  syncSharedPointSelectedLayerFilter,
} from '../../../src/utils/paint/shared-point-paint';

describe('syncSharedPointSelectedLayerFilter', () => {
  it('keeps resting badge bodies visible on select (shadow-only — no chrome swap)', () => {
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

    const circleShape = sharedPointCircleBodyFilter();
    // Same marker stays put — select only darkens the ground cast via feature-state.
    expect(setFilter).toHaveBeenCalledWith('pts', circleShape);
    expect(setFilter).toHaveBeenCalledWith('pts-outer-stroke', circleShape);
    expect(setFilter).toHaveBeenCalledWith('pts-glow', null);
    expect(setFilter).not.toHaveBeenCalledWith(
      'pts',
      expect.arrayContaining([sharedPointExcludeFeatureIdFilter('venueId', 'v1')])
    );
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
