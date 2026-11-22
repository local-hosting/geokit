import { describe, expect, it } from 'vitest';

import { coordinatesToH3, h3GetResolution } from '../../../src/geometry/core';
import { h3PanLockResolutionFromMapZoom } from '../../../src/geometry/resolution-from-zoom';
import {
  h3PanLockResolutionContainingViewport,
} from '../../../src/viewport/h3-pan-lock-resolution-containing-viewport';
import {
  mapCameraScopeH3Cells,
  mapCameraScopeInnerH3CellAtLngLat,
  panLockH3CellFromMapCamera,
  type MapCameraScopeViewport,
} from '../../../src/viewport/map-camera-scope-cells';

describe('mapCameraScopeH3Cells', () => {
  const viewport: MapCameraScopeViewport = {
    center: [-84.9105, 35.42458],
    zoom: 7.25,
  };

  it('sets outer from zoom and inner one resolution finer at the camera center', () => {
    const { inner, outer } = mapCameraScopeH3Cells(viewport);
    const outerRes = h3PanLockResolutionFromMapZoom(viewport.zoom);
    const [lng, lat] = viewport.center;
    expect(h3GetResolution(outer)).toBe(outerRes);
    expect(h3GetResolution(inner)).toBe(Math.min(15, outerRes + 1));
    expect(outer).toBe(coordinatesToH3(outerRes)([lat, lng]));
    expect(inner).toBe(coordinatesToH3(Math.min(15, outerRes + 1))([lat, lng]));
    if (outerRes < 15) {
      expect(h3GetResolution(inner)).toBeGreaterThan(h3GetResolution(outer));
    }
  });

  it('panLockH3CellFromMapCamera returns the outer cell', () => {
    expect(panLockH3CellFromMapCamera(viewport)).toBe(mapCameraScopeH3Cells(viewport).outer);
  });

  it('uses viewport containment resolution for outer when canvas size is known', () => {
    const sizedViewport: MapCameraScopeViewport = {
      center: [-84.9, 35.4],
      zoom: 10,
    };
    const size = { widthPx: 512, heightPx: 384 };
    const containing = h3PanLockResolutionContainingViewport(sizedViewport, size);
    const { outer } = mapCameraScopeH3Cells(sizedViewport, size);
    expect(h3GetResolution(outer)).toBe(containing);
  });

  it('mapCameraScopeInnerH3CellAtLngLat uses inner resolution at the click point, not the viewport center', () => {
    const viewport: MapCameraScopeViewport = {
      center: [-84.9105, 35.42458],
      zoom: 7.25,
    };
    const clickLngLat: readonly [number, number] = [-84.2, 35.9];
    const { inner: centerInner } = mapCameraScopeH3Cells(viewport);
    const clickInner = mapCameraScopeInnerH3CellAtLngLat(viewport, clickLngLat);
    expect(h3GetResolution(clickInner)).toBe(h3GetResolution(centerInner));
    expect(clickInner).not.toBe(centerInner);
    const [clickLng, clickLat] = clickLngLat;
    expect(clickInner).toBe(
      coordinatesToH3(h3GetResolution(clickInner))([clickLat, clickLng]),
    );
  });
});