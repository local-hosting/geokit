import { describe, expect, it } from 'vitest';

import { coordinatesToH3, h3GetResolution } from '../../../src/geometry/core';
import { h3PanLockResolutionFromMapZoom } from '../../../src/geometry/resolution-from-zoom';
import {
  h3CellAtMapCameraCenter,
  h3CellsFillingMapViewport,
} from '../../../src/viewport/map-viewport-h3';

describe('map viewport H3 helpers', () => {
  it('h3CellAtMapCameraCenter returns one hex at the camera center', () => {
    const viewport = { center: [-84.9105, 35.42458] as const, zoom: 7.25 };
    const cell = h3CellAtMapCameraCenter(viewport);
    const res = h3PanLockResolutionFromMapZoom(viewport.zoom);
    expect(h3GetResolution(cell)).toBe(res);
    expect(cell).toBe(coordinatesToH3(res)([35.42458, -84.9105]));
  });

  it('h3CellsFillingMapViewport tessellates approximate map bounds', () => {
    const viewport = { center: [-100, 40] as const, zoom: 4 };
    const cells = h3CellsFillingMapViewport(viewport);
    expect(cells.length).toBeGreaterThan(0);
    expect(h3GetResolution(cells[0]!)).toBe(h3PanLockResolutionFromMapZoom(4));
  });
});