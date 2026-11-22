import { describe, expect, it } from 'vitest';

import {
  resolveCommittedMapViewScopeViewport,
  resolveShowCommittedMapViewScopeOverlays,
} from '../../../src/map-view-scope/resolve-map-view-scope-viewport';

const saved = { center: [-84.9, 35.4] as const, zoom: 7.25 };
const live = { center: [-85.0, 35.5] as const, zoom: 8 };

describe('resolveCommittedMapViewScopeViewport', () => {
  it('uses saved camera only — never live', () => {
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: saved, liveCamera: live })).toBe(
      saved,
    );
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: null, liveCamera: live })).toBeNull();
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: saved, liveCamera: null })).toBe(
      saved,
    );
  });
});

describe('resolveShowCommittedMapViewScopeOverlays', () => {
  const viewport = { widthPx: 800, heightPx: 600 };

  it('shows blue scope hexes only when a saved baseline exists and the view is clean', () => {
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: saved,
        viewDirty: false,
        viewportSizePx: viewport,
      }),
    ).toBe(true);
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: saved,
        viewDirty: true,
        viewportSizePx: viewport,
      }),
    ).toBe(false);
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: null,
        viewDirty: false,
        viewportSizePx: viewport,
      }),
    ).toBe(false);
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: null,
        viewDirty: true,
        viewportSizePx: viewport,
      }),
    ).toBe(false);
  });

  it('waits for map canvas size before drawing (reload zoom-only shell is oversized)', () => {
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: saved,
        viewDirty: false,
        viewportSizePx: null,
      }),
    ).toBe(false);
    expect(
      resolveShowCommittedMapViewScopeOverlays({
        savedCamera: saved,
        viewDirty: false,
        viewportSizePx: { widthPx: 0, heightPx: 600 },
      }),
    ).toBe(false);
  });
});