import { describe, expect, it, vi } from 'vitest';
import {
  bindMapMoveendUrlSync,
  clampMapZoom,
  sanitizeMapHashFlatView,
} from '../../../../src/components/elements/map/map-url-sync';

describe('map url sync helpers', () => {
  it('clampMapZoom respects min and max navigation limits', () => {
    expect(clampMapZoom(2, { minZoom: 4, maxZoom: 16 })).toBe(4)
    expect(clampMapZoom(20, { minZoom: 4, maxZoom: 16 })).toBe(16)
    expect(clampMapZoom(9.25, { minZoom: 4, maxZoom: 16 })).toBe(9.25)
  })

  it('sanitizeMapHashFlatView strips pitch and bearing', () => {
    window.location.hash = '#map=5/40/-90/30/45';
    sanitizeMapHashFlatView({ terrainEnabled: false });
    expect(window.location.hash).toBe('#map=5/40/-90');
  });

  it('bindMapMoveendUrlSync updates hash on moveend', () => {
    vi.useFakeTimers();
    const map = {
      handlers: {} as Record<string, () => void>,
      on(event: string, handler: () => void) {
        this.handlers[event] = handler;
      },
      off(event: string) {
        delete this.handlers[event];
      },
      getCenter: () => ({ lat: 40, lng: -90 }),
      getZoom: () => 5,
      getPitch: () => 0,
      getBearing: () => 0,
    };
    const handle = bindMapMoveendUrlSync(map);
    map.handlers.moveend();
    vi.advanceTimersByTime(300);
    expect(window.location.hash).toBe('#map=5/40/-90');
    handle.unbind();
    vi.useRealTimers();
  });
});
