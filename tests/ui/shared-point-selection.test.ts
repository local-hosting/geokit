import { describe, expect, it, vi } from 'vitest';
import {
  clearSharedPointSelection,
  getSharedPointSelection,
  lookupSharedPointCoords,
  setSharedPointSelection,
} from '../../src/ui/utils/layer-styles';

function createMockMap() {
  const sources = new Map<string, { data: unknown; _data?: unknown }>();
  return {
    getSource: (id: string) => {
      const entry = sources.get(id);
      if (!entry) return undefined;
      return {
        _data: entry._data,
        data: entry._data ?? entry.data,
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
  it('prefers source geometry over click lngLat when selecting', () => {
    const map = createMockMap();
    const sourceId = 'venues-test';
    const venueSource = {
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { slug: 'venue-a' },
            geometry: { type: 'Point', coordinates: [-104.99, 39.7392] },
          },
        ],
      },
    };
    map._sources.set(sourceId, venueSource);
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-a',
      lngLat: { lng: -105.5, lat: 39.2 },
    });

    expect(lookupSharedPointCoords(map as never, sourceId, 'venue-a')).toEqual({
      lng: -104.99,
      lat: 39.7392,
    });
    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ geometry: { coordinates: number[] } }>;
    };
    expect(ringData.features[0].geometry.coordinates).toEqual([-104.99, 39.7392]);
  });
  it('clears dedicated hover overlay source on select', () => {
    const map = createMockMap();
    const sourceId = 'venues-test';
    map._sources.set(`${sourceId}-selection`, { data: null });
    map._sources.set(`${sourceId}-hover`, {
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
        ],
      },
    });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-a',
      lngLat: { lng: -85.7, lat: 38.2 },
    });

    const hoverData = map._sources.get(`${sourceId}-hover`)?.data as { features: unknown[] };
    expect(hoverData.features).toHaveLength(0);
  });
});
