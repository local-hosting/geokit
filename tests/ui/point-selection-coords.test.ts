import { describe, expect, it } from 'vitest';
import {
  POINT_GEOJSON_SOURCE_OPTIONS,
  readFirstPointCoordinatesFromGeoJsonSource,
} from '../../src/ui/utils/geojson-source-options';

describe('point selection coordinates', () => {
  it('uses zero tolerance for point geojson sources', () => {
    expect(POINT_GEOJSON_SOURCE_OPTIONS).toEqual({ tolerance: 0 });
  });

  it('reads the first point from a geojson source payload', () => {
    const source = {
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-70.877, 42.812] },
            properties: { id: 'listing-1' },
          },
        ],
      },
    };
    expect(readFirstPointCoordinatesFromGeoJsonSource(source)).toEqual([-70.877, 42.812]);
  });

  it('returns null when source has no point feature', () => {
    expect(
      readFirstPointCoordinatesFromGeoJsonSource({
        _data: { type: 'FeatureCollection', features: [] },
      })
    ).toBeNull();
  });
});
