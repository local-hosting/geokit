import { describe, expect, it, vi } from 'vitest';
import { ensurePlaceBoundaries } from '../../src/ui/utils/place-boundaries';
import {
  ADMIN_OUTLINE_HIT_FILL_OPACITY,
  ADMIN_OUTLINE_LINE_MIN_ZOOM,
} from '../../src/ui/utils/admin-outline-layer';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/utils/geojson-source-options';

describe('place-boundaries', () => {
  it('ensurePlaceBoundaries uses shared admin fill + line layers', () => {
    const cities: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Austin' },
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
      setPaintProperty: vi.fn(),
    };
    ensurePlaceBoundaries(map, cities, {
      polygonSourceId: 'p',
      lineSourceId: 'p-lines',
      fillLayerId: 'p-fill',
      lineLayerId: 'p-line',
      lineColor: '#93c5fd',
      lineWidth: 1,
      lineMinzoom: ADMIN_OUTLINE_LINE_MIN_ZOOM,
    });
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fill',
        id: 'p-fill',
        paint: expect.objectContaining({
          'fill-opacity': ADMIN_OUTLINE_HIT_FILL_OPACITY,
        }),
      }),
      undefined
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'line',
        id: 'p-line',
        paint: expect.objectContaining({
          'line-color': '#93c5fd',
          'line-opacity': ['step', ['zoom'], 0, ADMIN_OUTLINE_LINE_MIN_ZOOM, 1],
        }),
      }),
      undefined
    );
  });

  it('BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS uses zero tolerance for admin outlines', () => {
    expect(BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS).toEqual({
      tolerance: 0,
      buffer: 256,
      maxzoom: 14,
    });
  });
});
