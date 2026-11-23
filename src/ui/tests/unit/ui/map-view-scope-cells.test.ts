import { describe, expect, it } from 'vitest';

import { h3GetResolution } from '@local-hosting/geokit/h3';
import {
  MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER,
  resolveMapScopeHoverH3Cells,
  resolveMapScopeHoverOuterFromInner,
} from '@local-hosting/geokit/h3/map-scope-hover-h3-cells';

import { viewScopeCells } from '../../../src/map-view-scope/resolve-map-view-scope-cells';

describe('viewScopeCells', () => {
  const viewport = { center: [-84.9, 35.4] as const, zoom: 10 };

  it('returns hover inner + outer from the camera viewport', () => {
    const { inner, outer, source } = viewScopeCells(null, viewport, null);
    expect(inner).not.toBeNull();
    expect(outer).not.toBeNull();
    expect(source).toBe('camera');
    const hover = resolveMapScopeHoverH3Cells(viewport, viewport.center);
    expect(inner).toBe(hover.inner);
    expect(outer).toBe(hover.outer);
    expect(h3GetResolution(inner!)).toBe(
      h3GetResolution(outer!) + MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER,
    );
  });

  it('uses locker inner with hover outer parent (not map-center outer)', () => {
    const savedCamera = { center: [-84.9, 35.4] as const, zoom: 10 };
    const clickLngLat: [number, number] = [-83.1, 36.6];
    const scopeAtClick = { center: clickLngLat, zoom: savedCamera.zoom };
    const savedInner = resolveMapScopeHoverH3Cells(scopeAtClick, clickLngLat).inner;
    const { inner, outer, source } = viewScopeCells(savedInner, savedCamera, null);
    expect(inner).toBe(savedInner);
    expect(source).toBe('locker-geo-scope');
    expect(outer).toBe(resolveMapScopeHoverOuterFromInner(savedInner));
    const centerHover = resolveMapScopeHoverH3Cells(savedCamera, savedCamera.center);
    expect(outer).not.toBe(centerHover.outer);
    expect(h3GetResolution(inner!)).toBe(
      h3GetResolution(outer!) + MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER,
    );
  });

  it('falls back to locker geo-scope when viewport is missing', () => {
    const geo = resolveMapScopeHoverH3Cells(viewport, viewport.center).inner;
    const { inner, outer } = viewScopeCells(geo, null, null);
    expect(inner).toBe(geo);
    expect(outer).toBe(resolveMapScopeHoverOuterFromInner(geo));
    expect(h3GetResolution(outer!)).toBeLessThan(h3GetResolution(geo));
  });
});