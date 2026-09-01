import { describe, expect, it } from 'vitest';
import {
  repairFeature,
  repairFeatureCollection,
  repairGeoJSON,
  repairGeometry,
} from '../../../../src/utils/geojson/repair';

describe('geojson repair', () => {
  it('closes unclosed polygon rings and removes invalid positions', () => {
    const geometry = repairGeometry({
      type: 'Polygon',
      coordinates: [
        [
          [-74.1, 40.6],
          [-73.9, 40.6],
          [-73.9, 40.8],
          [-74.1, 40.8],
        ],
      ],
    });
    expect(geometry?.type).toBe('Polygon');
    const ring = (geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('repairs features and drops null geometries when configured', () => {
    const feature = repairFeature(
      {
        type: 'Feature',
        properties: { id: 'x' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-74.0, 40.7],
            [-74.0, 40.7],
            [-73.9, 40.8],
          ],
        },
      },
      { removeDuplicates: true }
    );
    expect(feature?.geometry.type).toBe('LineString');
    expect((feature?.geometry as GeoJSON.LineString).coordinates.length).toBe(2);
  });

  it('repairs feature collections and unknown geojson input', () => {
    const fc = repairFeatureCollection({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [-74.0, 40.7] },
        },
      ],
    });
    expect(fc?.features).toHaveLength(1);

    const repaired = repairGeoJSON({
      type: 'Point',
      coordinates: [200, 40.7],
    });
    expect(repaired).toBeNull();
  });
});

  it('repairs multipoint and multiline geometries', () => {
    const multiPoint = repairGeometry({
      type: 'MultiPoint',
      coordinates: [
        [-74.0, 40.7],
        [200, 40.7],
      ],
    });
    expect(multiPoint?.type).toBe('MultiPoint');
    expect((multiPoint as GeoJSON.MultiPoint).coordinates).toHaveLength(1);

    const multiLine = repairGeometry({
      type: 'MultiLineString',
      coordinates: [
        [
          [-74.0, 40.7],
          [-74.0, 40.7],
          [-73.9, 40.8],
        ],
      ],
    });
    expect(multiLine?.type).toBe('MultiLineString');
  });

  it('repairs multipolygon geometries and removes empty rings', () => {
    const multi = repairGeometry({
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
          ],
        ],
      ],
    });
    expect(multi?.type).toBe('MultiPolygon');
    const ring = (multi as GeoJSON.MultiPolygon).coordinates[0][0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });
