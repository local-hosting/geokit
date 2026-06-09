import { describe, expect, it } from 'vitest';
import { addAdminStateBoundaries } from '../../src/ui/utils/admin-boundaries';

describe('admin-boundaries', () => {
  it('addAdminStateBoundaries dedupes shared edges into line segments', () => {
    const states: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
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

    const config = {
      countySourceId: 'c',
      countyLineLayerId: 'c-line',
      stateSourceId: 's',
      stateLineLayerId: 's-line',
      countyLineColor: '#fff',
      countyLineWidth: 1,
      stateLineColor: '#fff',
      stateLineWidth: 1,
    };

    const lines = addAdminStateBoundaries(null, states, config);
    expect(lines.features.length).toBe(4);
  });
});
