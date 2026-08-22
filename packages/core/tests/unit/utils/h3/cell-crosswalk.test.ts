import { describe, expect, it } from 'vitest';
import { latLngToCell } from 'h3-js';
import {
  invertCellMap,
  keyToParentCell,
  rollupCellMap,
} from '../../../../src/utils/h3/cell-crosswalk.js';

const RES = 5;

describe('invertCellMap', () => {
  it('inverts cell → values[] to value → cell (first wins)', () => {
    const cellA = latLngToCell(38.24, -85.76, RES);
    const cellB = latLngToCell(40.71, -74.0, RES);
    const inverted = invertCellMap({
      [cellA]: ['40202', '40203'],
      [cellB]: ['10001'],
    });
    expect(inverted['40202']).toBe(cellA);
    expect(inverted['10001']).toBe(cellB);
  });
});

describe('rollupCellMap', () => {
  it('unions values under parent cells', () => {
    const child = latLngToCell(38.2527, -85.7585, RES);
    const rolled = rollupCellMap({ [child]: ['40202', '40203'] }, 4);
    const parents = Object.keys(rolled);
    expect(parents.length).toBe(1);
    expect(rolled[parents[0]!]).toEqual(['40202', '40203']);
  });
});

describe('keyToParentCell', () => {
  it('rolls a keyed native cell to parent resolution', () => {
    const native = latLngToCell(38.2527, -85.7585, RES);
    const parent = keyToParentCell('40202', native, {}, 4);
    expect(parent).toBeTruthy();
    expect(parent!.length).toBeGreaterThan(0);
  });

  it('uses inverted map when row value is missing', () => {
    const native = latLngToCell(38.2527, -85.7585, RES);
    const parent = keyToParentCell('40202', undefined, { '40202': native }, 4);
    expect(parent).toBeTruthy();
  });
});
