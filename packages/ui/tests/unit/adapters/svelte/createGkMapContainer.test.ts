import { describe, expect, it, vi } from 'vitest';
import { createGkMapContainer } from '../../../../src/adapters/svelte/createGkMapContainer.js';
import type { GkMapElement } from '../../../../src/adapters/shared/types.js';

describe('createGkMapContainer', () => {
  it('forwards ready events for maps in container', () => {
    const container = document.createElement('div');
    const map = document.createElement('gk-map') as GkMapElement;
    map.getMap = () => ({ id: 'in-container' });
    container.appendChild(map);
    document.body.appendChild(container);

    const onReady = vi.fn();
    const api = createGkMapContainer({ onReady });
    api.start(container);

    map.dispatchEvent(
      new CustomEvent('gk-map-ready', {
        bubbles: true,
        detail: { element: map, map: { id: 'in-container' } },
      })
    );

    expect(onReady).toHaveBeenCalledTimes(1);
    api.destroy();
    container.remove();
  });
});
