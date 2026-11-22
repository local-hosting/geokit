import { describe, expect, it } from 'vitest';

import { h3GetResolution } from '../../../src/geometry/core';
import { mapCameraScopeH3Cells } from '../../../src/viewport/map-camera-scope-cells';
import {
  h3PanLockResolutionContainingViewport,
  viewportBoundsContainedInH3CellAtCenter,
} from '../../../src/viewport/h3-pan-lock-resolution-containing-viewport';

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
});