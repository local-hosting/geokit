import { describe, expect, it } from 'vitest';
import type { Polygon } from 'geojson';
import { loadUsCrosswalkSync } from '../src/load/load';
import { ensureH3Projection } from '../src/h3/project';
import {
  allZipCentroids,
  buildZipToStateMap,
  clearZipCentroidCache,
  filterZipsByPolygon,
  stateForH3Cell,
  stateForPoint,
  stateForZip,
  usStateAbbrs,
  zipsInPolygon,
} from '../src/lookup/spatial';
import { h3ForZip } from '../src/lookup/convert';

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

describe('crosswalk spatial helpers', () => {
  it('resolves zips and state for Indianapolis', async () => {
    loadUsCrosswalkSync();
    await ensureH3Projection();

    expect(stateForZip('46204')).toBe('in');
    expect(stateForPoint(39.7684, -86.1581)).toBe('in');

    const h3 = h3ForZip('46204');
    expect(h3).toBeTruthy();
    expect(stateForH3Cell(h3!)).toBe('in');

    const polygon = boxPolygon(-86.2, 39.7, -86.1, 39.8);
    const zips = zipsInPolygon(polygon);
    expect(zips).toContain('46204');

    const centroids = allZipCentroids();
    expect(centroids.length).toBeGreaterThan(0);
    const inPolygon = filterZipsByPolygon(
      centroids.filter((centroid) => zips.includes(centroid.zip)),
      polygon,
    );
    expect(inPolygon.every((centroid) => zips.includes(centroid.zip))).toBe(true);

    const zipToState = buildZipToStateMap(['46204', '10001']);
    expect(zipToState['46204']).toBe('in');
    expect(zipToState['10001']).toBe('ny');

    const states = usStateAbbrs();
    expect(states).toContain('in');
    expect(states).toContain('ny');

    clearZipCentroidCache();
  });
});
