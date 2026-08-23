import { describe, expect, it, vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import { updateChoroplethFillLayerData } from '../../../src/ui/utils/choropleth-fill-layer.js';

describe('updateChoroplethFillLayerData', () => {
  it('updates geojson source data when setData is available', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };
    const setData = vi.fn();
    const map = {
      getSource: vi.fn(() => ({ setData })),
    };

    const updated = updateChoroplethFillLayerData(map, { sourceId: 'choropleth-src' }, geojson);

    expect(updated).toBe(true);
    expect(setData).toHaveBeenCalledWith(geojson);
  });

  it('returns false when source is missing or lacks setData', () => {
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [],
    };

    expect(updateChoroplethFillLayerData({}, { sourceId: 'missing' }, geojson)).toBe(false);
    expect(updateChoroplethFillLayerData({ getSource: () => ({}) }, { sourceId: 'x' }, geojson)).toBe(
      false
    );
  });
});
