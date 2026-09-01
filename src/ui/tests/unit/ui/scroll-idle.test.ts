/**
 * createScrollIdle — start/stop, getIsIdle, onStateChange, ref-counting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScrollIdle } from '../../../src/utils/scroll-idle';

describe('createScrollIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start idle (getIsIdle true by default)', () => {
    const api = createScrollIdle({ idleMs: 100 });
    expect(api.getIsIdle()).toBe(true);
    api.start();
    expect(api.getIsIdle()).toBe(true);
    api.stop();
  });

  it('should call onStateChange when scroll happens and after idleMs', () => {
    const onStateChange = vi.fn();
    const api = createScrollIdle({ idleMs: 200, onStateChange });
    api.start();

    expect(onStateChange).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('scroll'));
    expect(onStateChange).toHaveBeenCalledWith(false);
    onStateChange.mockClear();

    vi.advanceTimersByTime(200);
    expect(onStateChange).toHaveBeenCalledWith(true);

    api.stop();
  });

  it('should reset timer on repeated scroll events', () => {
    const onStateChange = vi.fn();
    const api = createScrollIdle({ idleMs: 300, onStateChange });
    api.start();

    window.dispatchEvent(new Event('scroll'));
    expect(onStateChange).toHaveBeenCalledWith(false);
    onStateChange.mockClear();

    vi.advanceTimersByTime(200);
    window.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(200);
    expect(onStateChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(onStateChange).toHaveBeenCalledWith(true);

    api.stop();
  });

  it('should support ref-counted start/stop', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const api = createScrollIdle({ idleMs: 100 });

    api.start();
    api.start();
    expect(addSpy).toHaveBeenCalledTimes(3); // scroll, wheel, touchmove once

    api.stop();
    expect(removeSpy).not.toHaveBeenCalled(); // ref count still 1
    api.stop();
    expect(removeSpy).toHaveBeenCalledTimes(3);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('should reset to idle on stop', () => {
    const onStateChange = vi.fn();
    const api = createScrollIdle({ idleMs: 500, onStateChange });
    api.start();

    window.dispatchEvent(new Event('scroll'));
    expect(api.getIsIdle()).toBe(false);
    onStateChange.mockClear();

    api.stop();
    expect(api.getIsIdle()).toBe(true);
    expect(onStateChange).toHaveBeenCalledWith(true);
  });
});
