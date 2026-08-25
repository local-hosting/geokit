import { describe, expect, it, vi } from 'vitest';
import { createGkPopupEvents } from '../../../../src/adapters/svelte/createGkPopupEvents.js';
import { dispatchClearPopupsEvent } from '../../../../src/lazy-popup.js';

describe('createGkPopupEvents', () => {
  it('clears popups from other maps only', () => {
    const onClear = vi.fn();
    const events = createGkPopupEvents({
      getSourceId: () => 'denver',
      onClearFromOtherMap: onClear,
    });

    events.start();
    dispatchClearPopupsEvent('denver');
    expect(onClear).not.toHaveBeenCalled();

    dispatchClearPopupsEvent('chicago');
    expect(onClear).toHaveBeenCalledTimes(1);

    events.destroy();
  });
});
