// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { resolveMaptilerRequestReferer } from '../src/maptiler-referer';

describe('resolveMaptilerRequestReferer', () => {
  it('prefers an explicit referer', () => {
    expect(
      resolveMaptilerRequestReferer({
        referer: 'http://localhost:5175',
        origin: 'http://ignored.example',
      }),
    ).toBe('http://localhost:5175/');
  });

  it('falls back to origin', () => {
    expect(resolveMaptilerRequestReferer({ origin: 'http://localhost:5175' })).toBe(
      'http://localhost:5175/',
    );
  });

  it('uses a stable localhost default when nothing is available', () => {
    expect(resolveMaptilerRequestReferer({})).toBe('http://localhost/');
  });
});
