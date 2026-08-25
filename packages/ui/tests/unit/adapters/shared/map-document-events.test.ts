import { describe, expect, it, vi } from 'vitest';
import { onGkMapReadyOnce } from '../../../../src/adapters/shared/map-document-events';

describe('onGkMapReadyOnce', () => {
  it('fires once and respects filter', () => {
    const onReady = vi.fn();
    const stop = onGkMapReadyOnce({
      filter: e => (e.target as HTMLElement)?.id === 'wanted',
      onReady,
    });
    document.dispatchEvent(new CustomEvent('gk-map-ready', { bubbles: true }));
    expect(onReady).not.toHaveBeenCalled();
    const el = document.createElement('gk-map');
    el.id = 'wanted';
    document.body.appendChild(el);
    el.dispatchEvent(new CustomEvent('gk-map-ready', { bubbles: true }));
    expect(onReady).toHaveBeenCalledTimes(1);
    el.dispatchEvent(new CustomEvent('gk-map-ready', { bubbles: true }));
    expect(onReady).toHaveBeenCalledTimes(1);
    stop();
  });
});
