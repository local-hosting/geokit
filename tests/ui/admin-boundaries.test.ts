import { describe, expect, it } from 'vitest';
import {
  addAdminCountyBoundaries,
  addAdminStateBoundaries,
  ensureAdminCityBoundaries,
} from '../../src/ui/utils/admin-boundaries';
import { BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS } from '../../src/ui/utils/geojson-source-options';

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
    expect(lines.features.length).toBe(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });

  it('addAdminCountyBoundaries dedupes shared edges into line segments', () => {
    const counties: GeoJSON.FeatureCollection = {
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

    const lines = addAdminCountyBoundaries(null, counties, config);
    expect(lines.features.length).toBe(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });

  it('BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS uses zero tolerance and tile buffer', () => {
    expect(BOUNDARY_LINE_GEOJSON_SOURCE_OPTIONS).toEqual({
      tolerance: 0,
      buffer: 256,
      maxzoom: 14,
    });
  });

  it('ensureAdminCityBoundaries emits ring linestrings from city polygons', () => {
    const cities: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { slug: 'nashville' },
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
      citySourceId: 'city-src',
      cityLineLayerId: 'city-line',
      cityLineColor: '#93c5fd',
      cityLineWidth: 1,
    };

    const lines = ensureAdminCityBoundaries(null, cities, config);
    expect(lines.features).toHaveLength(1);
    expect(lines.features[0]!.geometry.coordinates.length).toBe(5);
  });
});
