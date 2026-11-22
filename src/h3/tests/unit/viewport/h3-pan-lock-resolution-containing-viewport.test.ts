import { describe, expect, it } from 'vitest';

import { h3GetResolution } from '../../../src/geometry/core';
import { mapCameraScopeH3Cells } from '../../../src/viewport/map-camera-scope-cells';
import { H3_MAP_SCOPE_MIN_RESOLUTION } from '../../../src/viewport/map-scope-resolution';
import {
  h3PanLockResolutionContainingViewport,
  readMapViewportSizePx,
  viewportBoundsContainedInH3CellAtCenter,
} from '../../../src/viewport/h3-pan-lock-resolution-containing-viewport';

describe('readMapViewportSizePx', () => {
  it('uses CSS layout pixels (clientWidth) not backing-store width', () => {
    const size = readMapViewportSizePx({
      getCanvas: () => ({
        width: 1600,
        height: 1200,
        clientWidth: 800,
        clientHeight: 600,
      }),
    });
    expect(size).toEqual({ widthPx: 800, heightPx: 600 });
  });
});

describe('h3PanLockResolutionContainingViewport', () => {
  it('picks a finer resolution when the map canvas is small (viewport fits in a smaller hex)', () => {
    const viewport = { center: [-84.9105, 35.42458] as const, zoom: 7.25 };
    const zoomOnly = mapCameraScopeH3Cells(viewport).outer;
    const withCanvas = mapCameraScopeH3Cells(viewport, { widthPx: 420, heightPx: 320 }).outer;
    expect(h3GetResolution(withCanvas)).toBeGreaterThanOrEqual(h3GetResolution(zoomOnly));
  });

  it('reports containment for viewport corners inside the center cell', () => {
    const viewport = { center: [-84.9, 35.4] as const, zoom: 10 };
    const res = h3PanLockResolutionContainingViewport(viewport, { widthPx: 512, heightPx: 384 });
    expect(
      viewportBoundsContainedInH3CellAtCenter(viewport, res, { widthPx: 512, heightPx: 384 }),
    ).toBe(true);
  });

  it('never returns hemispheric resolutions for a continental viewport', () => {
    const viewport = { center: [-90, 35] as const, zoom: 3 };
    const size = { widthPx: 1200, heightPx: 800 };
    const { outer } = mapCameraScopeH3Cells(viewport, size);
    expect(h3GetResolution(outer)).toBeGreaterThanOrEqual(H3_MAP_SCOPE_MIN_RESOLUTION);
  });
});