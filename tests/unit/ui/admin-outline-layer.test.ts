import { describe, expect, it, vi } from 'vitest';
import {
  addAdminOutlineLayer,
  ADMIN_OUTLINE_HIT_FILL_OPACITY,
  ADMIN_OUTLINE_LINE_MIN_ZOOM,
} from '../../../src/ui/utils/admin-outline-layer';

describe('admin-outline-layer', () => {
  it('addAdminOutlineLayer creates transparent fill hit target and CDN line layer', () => {
    const polygons: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { postal: 'NE' },
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
    const basemapBorderIds = new Set([
      'Country border',
      'Disputed border',
      'Other border',
      'Other border dash',
    ]);
    const map = {
      getStyle: () => ({ sources: {}, layers: [] }),
      getLayer: (id: string) => (basemapBorderIds.has(id) ? {} : undefined),
      getSource: () => undefined,
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
    };

    addAdminOutlineLayer(map, polygons, {
      polygonSourceId: 'poly',
      lineSourceId: 'lines',
      fillLayerId: 'fill',
      lineLayerId: 'line',
      lineColor: '#fff',
      lineWidth: 1,
      lineMinzoom: 2,
    });

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fill',
        type: 'fill',
        paint: expect.objectContaining({
          'fill-opacity': ADMIN_OUTLINE_HIT_FILL_OPACITY,
        }),
      }),
      undefined
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'line',
        type: 'line',
        paint: expect.objectContaining({
          'line-color': '#fff',
          'line-opacity': ['step', ['zoom'], 0, 2, 1],
        }),
      }),
      undefined
    );
    expect(map.addLayer).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'line', id: 'line-visual' }),
      undefined
    );
    expect(map.setLayoutProperty).toHaveBeenCalledWith('Other border', 'visibility', 'none');
    expect(ADMIN_OUTLINE_LINE_MIN_ZOOM).toBe(7);
  });
});
