import { describe, expect, it, vi } from 'vitest';
import { bindGkMapContainerLifecycle } from '../../../../src/adapters/shared/container-lifecycle.js';
import type { GkMapElement } from '../../../../src/adapters/shared/types.js';

describe('bindGkMapContainerLifecycle', () => {
  it('forwards ready/unload/unfreeze only for maps inside the container', async () => {
    const container = document.createElement('div');
    const innerMap = document.createElement('gk-map') as GkMapElement;
    innerMap.getMap = () => ({ id: 'inner' });
    const outerMap = document.createElement('gk-map') as GkMapElement;
    outerMap.getMap = () => ({ id: 'outer' });

    container.appendChild(innerMap);
    document.body.appendChild(container);
    document.body.appendChild(outerMap);

    const onReady = vi.fn();
    const onUnload = vi.fn();
    const onUnfreeze = vi.fn();
    const unbind = bindGkMapContainerLifecycle(container, {
      onReady,
      onUnload,
      onUnfreeze,
    });

    innerMap.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        bubbles: true,
        detail: { element: innerMap, map: { id: 'inner' } },
      })
    );
    outerMap.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        bubbles: true,
        detail: { element: outerMap, map: { id: 'outer' } },
      })
    );

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0][0].map).toEqual({ id: 'inner' });

    innerMap.dispatchEvent(
      new CustomEvent('gk-map-unfreeze', {
        bubbles: true,
        detail: { element: innerMap, map: { id: 'inner' } },
      })
    );
    expect(onUnfreeze).toHaveBeenCalledTimes(1);

    innerMap.dispatchEvent(
      new CustomEvent('gk-map-unload', {
        bubbles: true,
        detail: { element: innerMap, map: { id: 'inner' } },
      })
    );
    expect(onUnload).toHaveBeenCalledTimes(1);

    unbind();
    container.remove();
    outerMap.remove();
  });

  it('no-ops for null container', () => {
    const unbind = bindGkMapContainerLifecycle(null, { onReady: vi.fn() });
    expect(unbind).toBeTypeOf('function');
    unbind();
  });
});
