import { describe, expect, it } from 'vitest';

import {
  resolveMapScopeHoverH3Cells,
  resolveMapScopeHoverOuterFromInner,
} from '@local-hosting/geokit/h3/map-scope-hover-h3-cells';
import { resolveSavedScopeDisplayH3Cells } from '../../../src/map-view-scope/resolve-saved-scope-display-h3-cells';

describe('resolveSavedScopeDisplayH3Cells', () => {
  const viewport = { center: [-84.9, 35.4] as const, zoom: 10 };
  const clickAnchor: [number, number] = [-84.2, 35.9];

  it('uses locker inner and parent outer from the hover pair', () => {
    const saved = resolveMapScopeHoverH3Cells(viewport, clickAnchor);
    const pair = resolveSavedScopeDisplayH3Cells(saved.inner, viewport, [-90, 40]);
    expect(pair).toEqual({
      inner: saved.inner,
      outer: resolveMapScopeHoverOuterFromInner(saved.inner),
    });
    expect(pair?.outer).toBe(saved.outer);
  });
});