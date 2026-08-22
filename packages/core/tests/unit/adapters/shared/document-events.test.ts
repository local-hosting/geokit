import { describe, expect, it, vi } from 'vitest';
import { bindDocumentEvents } from '../../../../src/adapters/shared/document-events.js';

describe('bindDocumentEvents', () => {
  it('registers listeners and removes them on cleanup', () => {
    const listener = vi.fn();
    const unbind = bindDocumentEvents([
      { type: 'gk-map-freeze', listener },
      { type: 'gk-map-stuck', listener, target: window },
    ]);

    document.dispatchEvent(new CustomEvent('gk-map-freeze'));
    window.dispatchEvent(new CustomEvent('gk-map-stuck'));
    expect(listener).toHaveBeenCalledTimes(2);

    unbind();
    document.dispatchEvent(new CustomEvent('gk-map-freeze'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
