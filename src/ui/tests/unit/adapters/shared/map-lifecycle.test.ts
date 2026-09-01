import { describe, expect, it, vi } from 'vitest';
import { bindGkMapLifecycle } from '../../../../src/adapters/shared/map-lifecycle';
import type { GkMapElement } from '../../../../src/adapters/shared/types';

describe('bindGkMapLifecycle', () => {
  it('forwards gk-map-ready and cleans up', () => {
    const gkMap = document.createElement('gk-map') as GkMapElement;
    gkMap.getMap = () => ({ id: 'map-1' });
    const onReady = vi.fn();
    const onUnload = vi.fn();

    const unbind = bindGkMapLifecycle(gkMap, { onReady, onUnload });

    gkMap.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        detail: { element: gkMap, map: { id: 'map-1' } },
      })
    );
    expect(onReady).toHaveBeenCalledTimes(1);

    gkMap.dispatchEvent(
      new CustomEvent('gk-map-unload', {
        detail: { element: gkMap, map: { id: 'map-1' } },
      })
    );
    expect(onUnload).toHaveBeenCalledTimes(1);

    unbind();
    gkMap.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        detail: { element: gkMap, map: { id: 'map-1' } },
      })
    );
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
