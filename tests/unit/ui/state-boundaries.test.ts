import { describe, expect, it, vi } from 'vitest';
import {
  addStateBoundaries,
  applyStateLinePaint,
} from '../../../src/ui/utils/admin-outline-preset';
import { ADMIN_OUTLINE_HIT_FILL_OPACITY } from '../../../src/ui/utils/admin-outline-layer';

describe('state-boundaries', () => {
  it('uses CDN fill hit target and line layer without basemap styling', () => {
    const states: GeoJSON.FeatureCollection = {
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
    const map = {
      loaded: () => true,
      isStyleLoaded: () => true,
      getStyle: () => ({ sources: {}, layers: [] }),
      getLayer: () => undefined,
      getSource: () => undefined,
      addSource: vi.fn(),
      addLayer: vi.fn(),
      setLayoutProperty: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayerZoomRange: vi.fn(),
      moveLayer: vi.fn(),
    };
    const config = {
      polygonSourceId: 's',
      lineSourceId: 's-lines',
      fillLayerId: 's-fill',
      lineLayerId: 's-line',
      lineColor: '#fff',
      lineWidth: 1,
      lineMinzoom: 2,
    };
    addStateBoundaries(map, states, config);
    applyStateLinePaint(map, config);
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'fill',
        id: 's-fill',
        paint: expect.objectContaining({
          'fill-opacity': ADMIN_OUTLINE_HIT_FILL_OPACITY,
        }),
      }),
      undefined
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'line',
        id: 's-line',
      }),
      undefined
    );
    expect(map.setPaintProperty).not.toHaveBeenCalledWith('Other border', 'line-color', '#fff');
  });
});
