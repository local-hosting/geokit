import { describe, expect, it } from 'vitest';

import { h3GetResolution } from '../../../src/geometry/core';
import {
  h3PanLockResolutionFromMapZoom,
  h3ResolutionFromZoom,
} from '../../../src/geometry/resolution-from-zoom';
import {
  MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA,
} from '../../../src/viewport/map-camera-scope-cells';
import {
  MAP_SCOPE_HOVER_OUTER_COARSEN_STEPS,
  MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER,
  resolveMapScopeHoverH3Cell,
  resolveMapScopeHoverH3Cells,
  resolveMapScopeHoverOuterFromInner,
} from '../../../src/viewport/map-scope-hover-h3-cells';
import { clampMapScopeH3Resolution } from '../../../src/viewport/map-scope-resolution';

describe('map scope hover h3 cells', () => {
  const lngLat = [-84.91, 35.42] as const;
  const zoom = 10;

  it('builds outer one step coarser than pan-lock and inner at pan-lock + 1', () => {
    const panLock = h3PanLockResolutionFromMapZoom(zoom);
    const { inner, outer } = resolveMapScopeHoverH3Cells({ center: lngLat, zoom }, lngLat);
    expect(h3GetResolution(outer)).toBe(
      clampMapScopeH3Resolution(panLock - MAP_SCOPE_HOVER_OUTER_COARSEN_STEPS),
    );
    expect(h3GetResolution(inner)).toBe(
      clampMapScopeH3Resolution(panLock + MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA),
    );
    expect(h3GetResolution(inner) - h3GetResolution(outer)).toBe(
      MAP_SCOPE_HOVER_OUTER_DELTA_FROM_INNER,
    );
    expect(resolveMapScopeHoverH3Cell({ center: lngLat, zoom }, lngLat)).toBe(inner);
  });

  it('derives outer as parent of inner for the saved pair', () => {
    const pair = resolveMapScopeHoverH3Cells({ center: lngLat, zoom }, lngLat);
    expect(resolveMapScopeHoverOuterFromInner(pair.inner)).toBe(pair.outer);
  });

  it('uses pan-lock outer coarser than protomap round inner curve', () => {
    const { outer } = resolveMapScopeHoverH3Cells({ center: lngLat, zoom }, lngLat);
    const catalogInner = h3ResolutionFromZoom(zoom) + MAP_CAMERA_SCOPE_INNER_RESOLUTION_DELTA;
    expect(h3GetResolution(outer)).toBeLessThan(catalogInner);
  });
});