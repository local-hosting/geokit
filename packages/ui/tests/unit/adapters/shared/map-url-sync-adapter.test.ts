import { describe, expect, it, vi } from 'vitest';
import {
  bindMapMoveendUrlSync,
  sanitizeMapHashFlatView,
} from '../../../../src/components/elements/map/map-url-sync.js';

describe('map url sync helpers', () => {
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
