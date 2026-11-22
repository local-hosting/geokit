import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { resolveNavigationShowCompass } from '../../../src/utils/resolve-navigation-show-compass';

describe('resolveNavigationShowCompass', () => {
  const matchMedia = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('matchMedia', matchMedia);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respects an explicit show-compass attribute', () => {
    expect(resolveNavigationShowCompass(true, true)).toBe(true);
    expect(resolveNavigationShowCompass(true, false)).toBe(false);
  });

  it('defaults to compass on fine pointers when attribute is omitted', () => {
    matchMedia.mockReturnValue({ matches: true });
    expect(resolveNavigationShowCompass(false, true)).toBe(true);
  });

  it('defaults to compass off on coarse pointers when attribute is omitted', () => {
    matchMedia.mockReturnValue({ matches: false });
    expect(resolveNavigationShowCompass(false, true)).toBe(false);
  });
});