import { describe, expect, it } from 'vitest';

import {
  clampMapScopeH3Resolution,
  H3_MAP_SCOPE_MIN_RESOLUTION,
} from '../../../src/viewport/map-scope-resolution';

describe('map scope H3 resolution floor', () => {
  it('forbids resolutions coarser than country scale', () => {
    expect(H3_MAP_SCOPE_MIN_RESOLUTION).toBe(2);
    expect(clampMapScopeH3Resolution(0)).toBe(2);
    expect(clampMapScopeH3Resolution(1)).toBe(2);
    expect(clampMapScopeH3Resolution(2)).toBe(2);
    expect(clampMapScopeH3Resolution(7)).toBe(7);
  });
});