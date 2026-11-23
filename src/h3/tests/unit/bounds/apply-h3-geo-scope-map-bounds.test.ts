import { describe, expect, it, vi } from 'vitest';

import { coordinatesToH3 } from '../../../src/geometry/core';
import {
  applyH3GeoScopeMaxBoundsToMap,
  GK_MAP_DEFAULT_MAX_ZOOM,
  GK_MAP_DEFAULT_MIN_ZOOM,
  minZoomForMapMaxBounds,
  applyH3PanLockMaxBoundsToMap,
} from '../../../src/bounds/apply-h3-map-bounds';
import { maxBoundsFromH3Cell, maxBoundsFromPanLockH3Cell, type MapMaxBounds } from '../../../src/bounds/map-max-bounds';

const BOUNDS: MapMaxBounds = [-86, 34, -84, 36];

describe('GK_MAP_DEFAULT_MIN_ZOOM', () => {
  it('matches the default gk-map min-zoom attribute', () => {
    expect(GK_MAP_DEFAULT_MIN_ZOOM).toBe(4);
  });
});

describe('GK_MAP_DEFAULT_MAX_ZOOM', () => {
  it('matches the default gk-map max-zoom attribute', () => {
    expect(GK_MAP_DEFAULT_MAX_ZOOM).toBe(16);
  });
});

describe('minZoomForMapMaxBounds', () => {
  it('uses cameraForBounds fit zoom so nav min matches maxBounds', () => {
    const cameraForBounds = vi.fn(() => ({ zoom: 8.25, center: [-85, 35] }));
    expect(minZoomForMapMaxBounds({ cameraForBounds }, BOUNDS)).toBeCloseTo(8.25, 5);
    expect(cameraForBounds).toHaveBeenCalledWith(BOUNDS, { padding: 0 });
  });

  it('clamps navigation floor to GK_MAP_DEFAULT_MIN_ZOOM', () => {
    const cameraForBounds = vi.fn(() => ({ zoom: 1.5, center: [-85, 35] }));
    expect(minZoomForMapMaxBounds({ cameraForBounds }, BOUNDS)).toBe(GK_MAP_DEFAULT_MIN_ZOOM);
  });

  it('returns null when the map cannot fit bounds', () => {
    expect(minZoomForMapMaxBounds({ cameraForBounds: () => undefined }, BOUNDS)).toBeNull();
    expect(minZoomForMapMaxBounds(null, BOUNDS)).toBeNull();
  });
});

describe('applyH3GeoScopeMaxBoundsToMap', () => {
  it('sets maxBounds and navigation minZoom so zoom-out disables at the bounds floor', () => {
    const cell = coordinatesToH3(5)([37.7749, -122.4194]);
    const bounds = maxBoundsFromH3Cell(cell);
    const setMaxBounds = vi.fn();
    const setMinZoom = vi.fn();
    const cameraForBounds = vi.fn(() => ({ zoom: 7.25, center: [-122.4, 37.77] }));
    applyH3GeoScopeMaxBoundsToMap({ setMaxBounds, setMinZoom, cameraForBounds }, cell);
    expect(setMaxBounds).toHaveBeenCalledWith(bounds);
    expect(cameraForBounds).toHaveBeenCalledWith(bounds, { padding: 0 });
    expect(setMinZoom).toHaveBeenCalledWith(7.25);
  });

  it('clears maxBounds when geo scope is absent', () => {
    const setMaxBounds = vi.fn();
    const setMinZoom = vi.fn();
    applyH3GeoScopeMaxBoundsToMap({ setMaxBounds, setMinZoom }, null);
    expect(setMaxBounds).toHaveBeenCalledWith(null);
    expect(setMinZoom).toHaveBeenCalledWith(GK_MAP_DEFAULT_MIN_ZOOM);
  });

  it('no-ops when the map cannot set maxBounds', () => {
    expect(() => applyH3GeoScopeMaxBoundsToMap({}, '852a1073fffffffff')).not.toThrow();
  });
});

describe('applyH3PanLockMaxBoundsToMap', () => {
  it('uses maxBoundsFromPanLockH3Cell without coarsening the lock cell again', () => {
    const cell = '872a1072bffffff';
    const bounds = maxBoundsFromPanLockH3Cell(cell);
    const setMaxBounds = vi.fn();
    applyH3PanLockMaxBoundsToMap({ setMaxBounds }, cell);
    expect(setMaxBounds).toHaveBeenCalledWith(bounds);
  });
});