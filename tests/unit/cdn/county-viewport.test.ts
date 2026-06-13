import { describe, expect, it } from 'vitest';
import {
  mergeCountyFeaturesByFips,
  resolveStateCodesForViewportBounds,
} from '../../../src/cdn/county-viewport';

describe('county-viewport', () => {
  it('resolves state codes intersecting viewport bounds', () => {
    const states: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { stateCode: 'tx' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-106, 25],
                [-93, 25],
                [-93, 36],
                [-106, 36],
                [-106, 25],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { stateCode: 'ca' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-124, 32],
                [-114, 32],
                [-114, 42],
                [-124, 42],
                [-124, 32],
              ],
            ],
          },
        },
      ],
    };

    const codes = resolveStateCodesForViewportBounds(states, {
      west: -100,
      south: 30,
      east: -95,
      north: 35,
    });
    expect(codes).toEqual(['tx']);
  });

  it('merges county features by fips without duplicates', () => {
    const target = new Map<string, GeoJSON.Feature>();
    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { fips: '48453' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
        {
          type: 'Feature',
          properties: { fips: '48453' },
          geometry: { type: 'Polygon', coordinates: [] },
        },
      ],
    };

    expect(mergeCountyFeaturesByFips(target, collection)).toBe(1);
    expect(target.size).toBe(1);
  });
});
