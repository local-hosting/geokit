import { describe, expect, it } from 'vitest';
import { latLngToCell } from 'h3-js';
import {
  joinCellMapToPolygon,
  lookupValuesForH3Cells,
  polygonGeometryToH3Cells,
} from '@local-hosting/geokit/h3';
import type { Polygon } from 'geojson';

const RES = 5;

function boxPolygon(minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ],
    ],
  };
}

describe('polygonGeometryToH3Cells', () => {
  it('returns covering cells for a polygon', () => {
    const polygon = boxPolygon(-85.78, 38.22, -85.74, 38.26);
    const cells = polygonGeometryToH3Cells(polygon, RES);
    expect(cells.length).toBeGreaterThan(0);
    expect(new Set(cells).size).toBe(cells.length);
  });
});

describe('lookupValuesForH3Cells', () => {
  it('deduplicates values across cells', () => {
    const cellA = latLngToCell(38.24, -85.76, RES);
    const cellB = latLngToCell(40.71, -74.0, RES);
    expect(cellA).not.toBe(cellB);
    const values = lookupValuesForH3Cells([cellA, cellB, cellA], {
      [cellA]: ['40202', '40203'],
      [cellB]: ['10001', '10002'],
    });
    expect(values).toEqual(['10001', '10002', '40202', '40203']);
  });
});

describe('joinCellMapToPolygon', () => {
  it('joins polygon geometry to values in a cell map', () => {
    const centerCell = latLngToCell(38.24, -85.76, RES);
    const polygon = boxPolygon(-85.78, 38.22, -85.74, 38.26);
    const values = joinCellMapToPolygon(
      polygon,
      {
        [centerCell]: ['40202'],
      },
      RES,
    );
    expect(values).toContain('40202');
  });

  it('uses centroid fallback for tiny polygons with no covering hits', () => {
    const centroidCell = latLngToCell(38.24, -85.76, RES);
    const polygon = boxPolygon(-85.7601, 38.2401, -85.7599, 38.2402);
    const values = joinCellMapToPolygon(
      polygon,
      {
        [centroidCell]: ['40202'],
      },
      RES,
      { centroidFallback: true },
    );
    expect(values).toEqual(['40202']);
  });
});
