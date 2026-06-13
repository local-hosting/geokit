import { describe, expect, it, vi } from 'vitest';
import { addCountyBoundaries } from '../../../src/ui/utils/admin-outline-preset';
import { ADMIN_OUTLINE_HIT_FILL_OPACITY } from '../../../src/ui/utils/admin-outline-layer';

describe('county-boundaries', () => {
  it('addCountyBoundaries uses fill hit target and CDN line layer', () => {
    const counties: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fips: '01001' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const map = {
      loaded: () => true,
      isStyleLoaded: () => true,
      getStyle: () => ({ sources: {}, layers: [] }),
      getLayer: () => undefined,
      getSource: () => undefined,
      addSource: vi.fn(),
      addLayer: vi.fn(),
    };
    addCountyBoundaries(map, counties, {
      polygonSourceId: 'c',
      lineSourceId: 'c-lines',
      fillLayerId: 'c-fill',
      lineLayerId: 'c-line',
      lineColor: '#fff',
      lineWidth: 0.5,
      minzoom: 7,
    });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fill',
        id: 'c-fill',
        minzoom: 7,
        paint: expect.objectContaining({
          'fill-opacity': ADMIN_OUTLINE_HIT_FILL_OPACITY,
        }),
      }),
      undefined
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'line',
        id: 'c-line',
        minzoom: 7,
        paint: expect.objectContaining({
          'line-color': '#fff',
          'line-width': 0.5,
        }),
      }),
      undefined
    );
  });
});
