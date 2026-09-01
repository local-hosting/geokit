import { describe, expect, it } from 'vitest';
import { resolveTurfDefault } from '../../../src/utils/turf-default-import';

describe('resolveTurfDefault', () => {
  it('returns a direct function export', () => {
    const fn = () => 'ok';
    expect(resolveTurfDefault(fn)).toBe(fn);
  });

  it('returns default when module is wrapped', () => {
    const fn = () => 'wrapped';
    expect(resolveTurfDefault({ default: fn })).toBe(fn);
  });

  it('throws when module has no callable export', () => {
    expect(() => resolveTurfDefault({})).toThrow(/Turf module/);
  });
});
