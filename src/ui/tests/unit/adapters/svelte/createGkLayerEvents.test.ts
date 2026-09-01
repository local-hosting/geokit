import { describe, expect, it, vi } from 'vitest';
import { createGkLayerEvents } from '../../../../src/adapters/svelte/createGkLayerEvents';

describe('createGkLayerEvents', () => {
  it('binds handlers on matching descendant layer', () => {
    const root = document.createElement('div');
    const layer = document.createElement('gk-layer');
    layer.setAttribute('dataset', 'state');
    root.appendChild(layer);

    const onClick = vi.fn();
    const events = createGkLayerEvents(
      () => root,
      'gk-layer[dataset="state"]',
      { 'gk-layer-click': onClick }
    );

    events.bind();
    layer.dispatchEvent(new CustomEvent('gk-layer-click', { detail: { id: 'co' } }));
    expect(onClick).toHaveBeenCalledTimes(1);

    events.stop();
    layer.dispatchEvent(new CustomEvent('gk-layer-click', { detail: { id: 'ut' } }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
