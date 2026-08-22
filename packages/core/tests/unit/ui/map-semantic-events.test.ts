// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindGkMapSemanticEvents } from '../../../src/ui/utils/map-semantic-events.js';

describe('bindGkMapSemanticEvents', () => {
  it('dispatches gk-map-moveend and gk-map-click', () => {
    const gkMap = document.createElement('gk-map');
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    const map = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(handler);
      }),
      off: vi.fn(),
      getBounds: () => ({ north: 1 }),
    };

    const moveend = vi.fn();
    const click = vi.fn();
    gkMap.addEventListener('gk-map-moveend', moveend);
    gkMap.addEventListener('gk-map-click', click);

    bindGkMapSemanticEvents(gkMap, map);

    handlers.moveend?.[0]?.();
    expect(moveend).toHaveBeenCalledTimes(1);

    handlers.click?.[0]?.({ lngLat: { lng: 1, lat: 2 } });
    expect(click).toHaveBeenCalledTimes(1);
  });
});
