import { describe, expect, it } from 'vitest';
import {
  compactH3CellId,
  expandH3CellId,
} from '@local-hosting/geokit/h3';
import { normalizeH3CellToResolution } from '@local-hosting/geokit/h3';

describe('h3 cell-id', () => {
  it('strips trailing f padding for catalog URL paths', () => {
    expect(compactH3CellId('84485b7ffffffff')).toBe('84485b7');
    expect(compactH3CellId('85283477fffffff')).toBe('85283477');
    expect(compactH3CellId('820c07')).toBe('820c07');
    expect(compactH3CellId('8112f')).toBe('8112');
    expect(compactH3CellId('8148f')).toBe('8148');
  });

  it('round-trips compact ids through expand', () => {
    const full = '85283477fffffff';
    expect(expandH3CellId(compactH3CellId(full))).toBe(full);
  });
});

it('normalizes finer cells to platform resolution', () => {
  const r2 = compactH3CellId('82266ffffffffff');
  expect(normalizeH3CellToResolution(r2, 1)).toBe('81267');
});
