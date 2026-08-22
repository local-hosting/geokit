import { describe, expect, it, vi } from 'vitest';
import {
  dispatchClearPopupsEvent,
  onClearPopupsEvent,
  onPopupClosedEvent,
} from '../../../src/ui/lazy-popup.js';

describe('lazy-popup events', () => {
  it('onClearPopupsEvent ignores own sourceId', () => {
    const onClear = vi.fn();
    const unbind = onClearPopupsEvent('denver', onClear);
    dispatchClearPopupsEvent('denver');
    expect(onClear).not.toHaveBeenCalled();
    dispatchClearPopupsEvent('chicago');
    expect(onClear).toHaveBeenCalledTimes(1);
    unbind();
  });

  it('onPopupClosedEvent forwards detail', () => {
    const onClosed = vi.fn();
    const unbind = onPopupClosedEvent(onClosed);
    const popup = { id: 'p1' };
    document.dispatchEvent(
      new CustomEvent('gk-popup-closed', { detail: { popup, map: {} } })
    );
    expect(onClosed).toHaveBeenCalledWith({ popup, map: {} });
    unbind();
  });
});
