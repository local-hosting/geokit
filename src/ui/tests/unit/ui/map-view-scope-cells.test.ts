import { describe, expect, it } from 'vitest';

import { h3GetResolution, h3ToCoordinates } from '@local-hosting/geokit/h3';
import {
  mapCameraScopeH3Cells,
  mapCameraScopeInnerH3CellAtLngLat,
} from '@local-hosting/geokit/h3/map-camera-scope-cells';

import { viewScopeCells } from '../../../src/map-view-scope/resolve-map-view-scope-cells';

describe('viewScopeCells', () => {
  const viewport = { center: [-84.9, 35.4] as const, zoom: 10 };
  const size = { widthPx: 512, heightPx: 384 };

  it('returns inner one resolution finer than outer from the same camera viewport', () => {
    const { inner, outer } = viewScopeCells(null, viewport, size);
    expect(inner).not.toBeNull();
    expect(outer).not.toBeNull();
    const pair = mapCameraScopeH3Cells(viewport, size);
    expect(outer).toBe(pair.outer);
    expect(inner).toBe(pair.inner);
    expect(h3GetResolution(inner!)).toBe(h3GetResolution(outer!) + 1);
  });

  it('uses locker inner with pan-lock outer containing that cell (not map center)', () => {
    const savedCamera = { center: [-84.9, 35.4] as const, zoom: 10 };
    const clickLngLat: [number, number] = [-83.1, 36.6];
    const scopeAtClick = { center: clickLngLat, zoom: savedCamera.zoom };
    const savedInner = mapCameraScopeInnerH3CellAtLngLat(scopeAtClick, clickLngLat, size);
    const { inner, outer, source } = viewScopeCells(savedInner, savedCamera, size);
    expect(inner).toBe(savedInner);
    expect(source).toBe('locker-geo-scope');
    const [lat, lng] = h3ToCoordinates(savedInner);
    const outerAtInner = mapCameraScopeH3Cells(
      { center: [lng, lat], zoom: savedCamera.zoom },
      size,
    ).outer;
    expect(outer).toBe(outerAtInner);
    expect(outer).not.toBe(mapCameraScopeH3Cells(savedCamera, size).outer);
    expect(h3GetResolution(inner!)).toBe(h3GetResolution(outer!) + 1);
  });

  it('falls back to locker geo-scope when viewport is missing', () => {
    const geo = mapCameraScopeH3Cells(viewport, size).inner;
    const { inner, outer } = viewScopeCells(geo, null, null);
    expect(inner).toBe(geo);
    expect(outer).not.toBeNull();
    expect(h3GetResolution(outer!)).toBeLessThan(h3GetResolution(geo));
  });
});