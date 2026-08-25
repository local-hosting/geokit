// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { bindGkMapPointEventsLifecycle } from '../../../../src/adapters/shared/point-events-lifecycle';

describe('bindGkMapPointEventsLifecycle', () => {
  it('wires on gk-map-ready and re-wires on gk-map-unfreeze', () => {
    const container = document.createElement('div');
    const gkMap = document.createElement('gk-map');
    container.appendChild(gkMap);
    const onClick = vi.fn();
    const unbind = bindGkMapPointEventsLifecycle(container, { onClick });

    const map = {};
    document.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        detail: { map, element: gkMap },
        bubbles: true,
      })
    );

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: { map, element: gkMap, features: [{ properties: { slug: 'a' } }] },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(1);

    document.dispatchEvent(
      new CustomEvent('gk-map-unfreeze', {
        detail: { map, element: gkMap },
        bubbles: true,
      })
    );

    gkMap.dispatchEvent(
      new CustomEvent('gk-point-click', {
        detail: { map, element: gkMap, features: [{ properties: { slug: 'b' } }] },
      })
    );
    expect(onClick).toHaveBeenCalledTimes(2);

    unbind();
  });
});
