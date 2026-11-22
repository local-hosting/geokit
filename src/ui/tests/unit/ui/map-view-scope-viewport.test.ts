import { describe, expect, it } from 'vitest';

import {
  resolveCommittedMapViewScopeViewport,
  resolveTentativeMapViewScopeViewport,
} from '../../../src/map-view-scope/resolve-map-view-scope-viewport';

const saved = { center: [-84.9, 35.4] as const, zoom: 7.25 };
const live = { center: [-85.0, 35.5] as const, zoom: 8 };

describe('resolveCommittedMapViewScopeViewport', () => {
  it('prefers saved camera over live', () => {
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: saved, liveCamera: live })).toBe(
      saved,
    );
  });

  it('returns null when there is no saved camera (no live tracking)', () => {
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: null, liveCamera: live })).toBeNull();
    expect(resolveCommittedMapViewScopeViewport({ savedCamera: saved, liveCamera: null })).toBe(
      saved,
    );
  });
});

describe('resolveTentativeMapViewScopeViewport', () => {
  it('returns live camera only when dirty and save is hovered', () => {
    expect(
      resolveTentativeMapViewScopeViewport({
        viewDirty: true,
        savePreviewHover: true,
        liveCamera: live,
      }),
    ).toBe(live);
    expect(
      resolveTentativeMapViewScopeViewport({
        viewDirty: false,
        savePreviewHover: true,
        liveCamera: live,
      }),
    ).toBeNull();
    expect(
      resolveTentativeMapViewScopeViewport({
        viewDirty: true,
        savePreviewHover: false,
        liveCamera: live,
      }),
    ).toBeNull();
  });
});