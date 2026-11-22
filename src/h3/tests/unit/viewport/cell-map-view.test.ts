import { describe, expect, it } from 'vitest';

import { coordinatesToH3 } from '../../../src/geometry/core';
import { h3ResolutionFromZoom } from '../../../src/geometry/resolution-from-zoom';
import { h3CellToMapView } from '../../../src/viewport/cell-map-view';

describe('h3CellToMapView', () => {
  it('centers on the cell and picks zoom from the resolution curve', () => {
    const h3Cell = coordinatesToH3(8)([37.7749, -122.4194]);
    const view = h3CellToMapView(h3Cell);
    expect(view.resolution).toBe(8);
    expect(view.lat).toBeCloseTo(37.7749, 1);
    expect(view.lng).toBeCloseTo(-122.4194, 1);
    expect(h3ResolutionFromZoom(view.zoom)).toBe(8);
  });

  it('throws for invalid h3', () => {
    expect(() => h3CellToMapView('not-a-cell')).toThrow(/invalid h3/i);
  });
});