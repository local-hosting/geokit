import { describe, expect, it } from 'vitest';

import { coordinatesToH3, h3GetResolution } from '../../../src/geometry/core';
import { h3ToBoundary } from '../../../src/geometry/boundary';
import {
  h3CellForMapMaxBounds,
  MAP_MAX_BOUNDS_COARSEN_STEPS,
  maxBoundsFromH3Cell,
  maxBoundsFromPanLockH3Cell,
  rawMaxBoundsFromH3Cell,
} from '../../../src/bounds/map-max-bounds';
import { H3_MAP_SCOPE_MIN_RESOLUTION } from '../../../src/viewport/map-scope-resolution';
import { MAP_MAX_BOUNDS_BBOX_PAD_FRACTION } from '../../../src/bounds/pad-lng-lat-bounds';

describe('maxBoundsFromH3Cell', () => {
  it('returns padded west/south/east/north covering the max-bounds lock cell', () => {
    const cell = coordinatesToH3(5)([37.7749, -122.4194]);
    const bounds = maxBoundsFromH3Cell(cell);
    const ring = h3ToBoundary(h3CellForMapMaxBounds(cell));

    const lats = ring.map(([lat]) => lat);
    const lngs = ring.map(([, lng]) => lng);
    const raw = rawMaxBoundsFromH3Cell(cell);
    const [west, south, east, north] = raw;

    expect(west).toBeCloseTo(Math.min(...lngs), 5);
    expect(south).toBeCloseTo(Math.min(...lats), 5);
    expect(east).toBeCloseTo(Math.max(...lngs), 5);
    expect(north).toBeCloseTo(Math.max(...lats), 5);
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);

    const [pWest, pSouth, pEast, pNorth] = bounds;
    expect(pWest).toBeLessThan(west);
    expect(pEast).toBeGreaterThan(east);
    expect(pSouth).toBeLessThan(south);
    expect(pNorth).toBeGreaterThan(north);
  });

  it('applies bbox padding on top of the lock cell', () => {
    const cell = coordinatesToH3(5)([37.7749, -122.4194]);
    const raw = rawMaxBoundsFromH3Cell(cell);
    const padded = maxBoundsFromH3Cell(cell);
    const f = MAP_MAX_BOUNDS_BBOX_PAD_FRACTION;
    const [w, , e] = raw;
    expect(padded[0]).toBeCloseTo(w - (e - w) * f, 5);
    expect(padded[2]).toBeCloseTo(e + (e - w) * f, 5);
  });

  it('throws for invalid h3', () => {
    expect(() => maxBoundsFromH3Cell('not-a-cell')).toThrow(/invalid h3/i);
  });

  it('uses a coarser parent cell for maxBounds than the stored geo-scope hex', () => {
    const cell = coordinatesToH3(7)([35.045, -85.31]);
    const lockCell = h3CellForMapMaxBounds(cell);
    expect(h3GetResolution(lockCell)).toBe(7 - MAP_MAX_BOUNDS_COARSEN_STEPS);

    const [west, south, east, north] = maxBoundsFromH3Cell(cell);
    const ring = h3ToBoundary(cell);
    const lngs = ring.map(([, lng]) => lng);
    const lats = ring.map(([lat]) => lat);
    expect(west).toBeLessThan(Math.min(...lngs));
    expect(east).toBeGreaterThan(Math.max(...lngs));
    expect(south).toBeLessThan(Math.min(...lats));
    expect(north).toBeGreaterThan(Math.max(...lats));
  });

  it('outer lock cell is coarser than a project geo-scope cell id', () => {
    const geoScopeCell = '8744cd5a3ffffff';
    const outer = h3CellForMapMaxBounds(geoScopeCell);
    expect(h3GetResolution(outer)).toBeLessThan(h3GetResolution(geoScopeCell));
  });

  it('does not coarsen country geo scope below the map scope floor', () => {
    const countryCell = coordinatesToH3(H3_MAP_SCOPE_MIN_RESOLUTION)([35.4, -84.9]);
    const lockCell = h3CellForMapMaxBounds(countryCell);
    expect(h3GetResolution(lockCell)).toBe(H3_MAP_SCOPE_MIN_RESOLUTION);
  });

  it('maxBoundsFromPanLockH3Cell matches geo-scope coarsen for the same lock cell', () => {
    const cell = coordinatesToH3(5)([37.7749, -122.4194]);
    const lockCell = h3CellForMapMaxBounds(cell);
    expect(maxBoundsFromPanLockH3Cell(lockCell)).toEqual(maxBoundsFromH3Cell(cell));
  });

  it('barrel re-exports applyH3GeoScopeMaxBoundsToMap without ESM init cycles', async () => {
    const mod = await import('../../../src/bounds/map-max-bounds');
    expect(typeof mod.applyH3GeoScopeMaxBoundsToMap).toBe('function');
  });
});