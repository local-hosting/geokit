import { describe, expect, it, vi } from 'vitest';
import {
  clearSharedPointSelection,
  getSharedPointSelection,
  setSharedPointSelection,
} from '../../src/ui/utils/layer-styles';

function createMockMap() {
  const sources = new Map<string, { data: unknown }>();
  return {
    getSource: (id: string) => {
      const entry = sources.get(id);
      if (!entry) return undefined;
      return {
        setData: (data: unknown) => {
          entry.data = data;
        },
      };
    },
    addSource: vi.fn(),
    getLayer: vi.fn(),
    addLayer: vi.fn(),
    _sources: sources,
  };
}

describe('shared point selection', () => {
  it('tracks selection and moves the dedicated ring source', () => {
    const map = createMockMap();
    const sourceId = 'venues-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-a',
      lngLat: { lng: -85.7, lat: 38.2 },
    });

    const state = getSharedPointSelection(map as never, sourceId);
    expect(state?.featureId).toBe('venue-a');
    expect(state?.lngLat).toEqual({ lng: -85.7, lat: 38.2 });

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ geometry: { coordinates: number[] } }>;
    };
    expect(ringData.features[0].geometry.coordinates).toEqual([-85.7, 38.2]);
  });

  it('clears selection state and ring source', () => {
    const map = createMockMap();
    const sourceId = 'venues-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-a',
      lngLat: { lng: 1, lat: 2 },
    });
    clearSharedPointSelection(map as never, sourceId);

    expect(getSharedPointSelection(map as never, sourceId)?.featureId).toBeNull();
    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: unknown[];
    };
    expect(ringData.features).toHaveLength(0);
  });
  it('copies selected feature properties onto the ring source', () => {
    const map = createMockMap();
    const sourceId = 'venues-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-a',
      lngLat: { lng: -85.7, lat: 38.2 },
      properties: { type: 'partner', averageRating: 4.2 },
    });

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
    expect(ringData.features[0].properties).toEqual({
      type: 'partner',
      averageRating: 4.2,
    });
  });
});
