import { describe, expect, it, vi } from 'vitest';
import { createGkMap } from '../../../../src/adapters/svelte/createGkMap.js';
import type { GkMapElement } from '../../../../src/adapters/shared/types.js';

describe('createGkMap', () => {
  it('tracks ready state via subscribe', () => {
    const gkMap = createGkMap();
    const states: boolean[] = [];
    const unsub = gkMap.subscribe(state => states.push(state.isReady));

    expect(gkMap.get().isReady).toBe(false);

    const el = document.createElement('gk-map') as GkMapElement;
    el.getMap = () => ({ id: 'map-1' });
    gkMap.setMapElement(el);

    el.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        detail: { element: el, map: { id: 'map-1' } },
      })
    );

    expect(states).toContain(true);
    expect(gkMap.get().mapInstance).toEqual({ id: 'map-1' });

    gkMap.destroy();
    unsub();
  });

  it('invokes onReady handler from options', async () => {
    const onReady = vi.fn();
    const api = createGkMap({ onReady });
    const el = document.createElement('gk-map') as GkMapElement;
    el.getMap = () => ({ id: 'map-2' });
    api.setMapElement(el);

    el.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        detail: { element: el, map: { id: 'map-2' } },
      })
    );

    expect(onReady).toHaveBeenCalledTimes(1);
    api.destroy();
  });
});
