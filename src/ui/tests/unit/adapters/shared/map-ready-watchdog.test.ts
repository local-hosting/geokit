import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleMapReadyWatchdog,
  tryForceGkMapReady,
} from '../../../../src/adapters/shared/map-ready-watchdog';
import type { GkMapElement } from '../../../../src/adapters/shared/types';

describe('map-ready-watchdog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tryForceGkMapReady calls onReady when map is renderable', () => {
    const el = document.createElement('gk-map') as GkMapElement;
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    document.body.appendChild(el);
    el.getMap = () => ({ isStyleLoaded: () => true });

    const onReady = vi.fn();
    const forced = tryForceGkMapReady(el, onReady);

    expect(forced).toBe(true);
    expect(onReady).toHaveBeenCalledWith({
      element: el,
      map: { isStyleLoaded: expect.any(Function) },
    });
    el.remove();
  });

  it('scheduleMapReadyWatchdog resolves when canvas is ready', () => {
    const el = document.createElement('gk-map') as GkMapElement;
    document.body.appendChild(el);
    el.getMap = () => ({ isStyleLoaded: () => false });

    const onReady = vi.fn();
    const stop = scheduleMapReadyWatchdog(el, {
      canvasReadyMs: 0,
      pollMs: 100,
      onReady,
    });

    const canvas = document.createElement('canvas');
    el.appendChild(canvas);
    vi.advanceTimersByTime(100);

    expect(onReady).toHaveBeenCalledTimes(1);
    stop();
    el.remove();
  });
});
