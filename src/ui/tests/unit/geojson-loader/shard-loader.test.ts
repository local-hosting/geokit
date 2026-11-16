import { latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { compactH3CellId } from '@local-hosting/geokit/h3';
import { h3CellIdsForViewportLoad } from '@local-hosting/geokit/ui/geojson-loader/shard-loader';

describe('h3CellIdsForViewportLoad', () => {
  it('includes a neighbor ring when neighborDiskK is set', () => {
    const centerLat = 39.1;
    const centerLng = -94.6;
    const resolution = 3;
    const center = compactH3CellId(latLngToCell(centerLat, centerLng, resolution))!;

    const coreOnly = h3CellIdsForViewportLoad({
      bounds: { west: -95, south: 38.8, east: -94.2, north: 39.4 },
      centerLat,
      centerLng,
      resolution,
      neighborDiskK: 0,
    });
    const withNeighbors = h3CellIdsForViewportLoad({
      bounds: { west: -95, south: 38.8, east: -94.2, north: 39.4 },
      centerLat,
      centerLng,
      resolution,
      neighborDiskK: 1,
    });

    expect(coreOnly.length).toBeGreaterThan(0);
    expect(withNeighbors.length).toBeGreaterThan(coreOnly.length);
    expect(withNeighbors).toContain(center);
    for (const cell of coreOnly) {
      expect(withNeighbors).toContain(cell);
    }
  });
});
