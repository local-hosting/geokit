// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindGkMapSemanticEvents } from '../../../src/ui/utils/map-semantic-events.js';
import { offGkMapEvent, onGkMapEvent } from '../../../src/ui/utils/map-element-on.js';

describe('map-element-on', () => {
  it('onGkMapEvent receives gk-map-moveend detail', () => {
    const gkMap = document.createElement('gk-map');
    const handler = vi.fn();
    const unbind = onGkMapEvent(gkMap, 'moveend', handler);

    gkMap.dispatchEvent(
      new CustomEvent('gk-map-moveend', {
        detail: { map: {}, element: gkMap, bounds: { north: 1 } },
      })
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ element: gkMap, bounds: { north: 1 } })
    );

    unbind();
    gkMap.dispatchEvent(
      new CustomEvent('gk-map-moveend', {
        detail: { map: {}, element: gkMap },
      })
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('offGkMapEvent removes listener', () => {
    const gkMap = document.createElement('gk-map');
    const handler = vi.fn();
    onGkMapEvent(gkMap, 'click', handler);
    offGkMapEvent(gkMap, 'click', handler);

    gkMap.dispatchEvent(
      new CustomEvent('gk-map-click', {
        detail: { map: {}, element: gkMap },
      })
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('gk-map.on integrates with bindGkMapSemanticEvents', () => {
    const gkMap = document.createElement('gk-map') as HTMLElement & {
      on: typeof onGkMapEvent extends (el: HTMLElement, e: infer E, h: infer H) => unknown
        ? <Ev extends 'moveend' | 'click'>(event: Ev, handler: (detail: unknown) => void) => () => void
        : never;
    };
    Object.assign(gkMap, {
      on: (event: 'moveend' | 'click', handler: (detail: unknown) => void) =>
        onGkMapEvent(gkMap, event, handler as never),
    });

    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    const map = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handlers[event] ?? [];
        handlers[event].push(handler);
      }),
      off: vi.fn(),
      getBounds: () => ({}),
    };

    const moveend = vi.fn();
    gkMap.on('moveend', moveend);
    bindGkMapSemanticEvents(gkMap, map);
    handlers.moveend?.[0]?.();
    expect(moveend).toHaveBeenCalledTimes(1);
  });
});
