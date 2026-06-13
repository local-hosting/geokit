import { describe, expect, it } from 'vitest';
import {
  isPublishedCellLayerId,
  resolvePublishedCellLayerId,
} from '../../../src/cdn/cell-catalog-alias';

describe('cell-catalog-alias', () => {
  const catalog = new Set(['8126', '81267', '812ab']);

  it('returns exact catalog id for 4- and 5-char r1 keys', () => {
    expect(resolvePublishedCellLayerId('81267', catalog)).toBe('81267');
    expect(resolvePublishedCellLayerId('8126', catalog)).toBe('8126');
  });

  it('maps shorter valid id to the only published extension at same resolution', () => {
    const shortOnly = new Set(['81267', '812ab']);
    expect(resolvePublishedCellLayerId('8126', shortOnly)).toBe('81267');
  });

  it('does not alias sibling cells that only share a string prefix', () => {
    expect(resolvePublishedCellLayerId('8126b', new Set(['8126']))).toBeNull();
  });

  it('strips invalid trailing hex from requested ids', () => {
    expect(resolvePublishedCellLayerId('81267a', catalog)).toBe('81267');
    expect(resolvePublishedCellLayerId('81267b', catalog)).toBe('81267');
  });

  it('returns null when extension is ambiguous', () => {
    expect(resolvePublishedCellLayerId('8126', catalog)).toBe('8126');
    expect(resolvePublishedCellLayerId('812', new Set(['8126', '81267']))).toBeNull();
  });

  it('returns null for unrelated ids', () => {
    expect(resolvePublishedCellLayerId('82278', catalog)).toBeNull();
    expect(isPublishedCellLayerId('82278', catalog)).toBe(false);
  });

  it('isPublishedCellLayerId accepts resolved alias forms', () => {
    expect(isPublishedCellLayerId('8126', new Set(['81267']))).toBe(true);
    expect(isPublishedCellLayerId('81267a', catalog)).toBe(true);
  });
});
