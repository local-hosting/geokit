import { describe, expect, it } from 'vitest';
import { filterCellsInCoverage } from '../../../../src/utils/h3/viewport-coverage.js';
import { latLngToCell } from 'h3-js';

describe('filterCellsInCoverage', () => {
  it('keeps cells that normalize into the coverage index', () => {
    const res = 7;
    const center = latLngToCell(42.36, -71.06, res);
    const child = latLngToCell(42.361, -71.061, res + 1);
    const filtered = filterCellsInCoverage([child, center], new Set([center]), res);
    expect(filtered).toContain(center);
    expect(filtered.length).toBeGreaterThan(0);
  });
});
