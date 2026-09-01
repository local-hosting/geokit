import { describe, it, expect, vi } from 'vitest';
import { onMapViewportSettled } from '../../../src/utils/map-viewport';

describe('onMapViewportSettled', () => {
  it('fires after dragend when not dragging', () => {
    const listeners = new Map<string, Set<() => void>>();
    const map = {
      on: (type: string, listener: () => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      },
      off: (type: string, listener: () => void) => {
        listeners.get(type)?.delete(listener);
      },
    };

    const onSettled = vi.fn();
    const cleanup = onMapViewportSettled(map, onSettled);

    listeners.get('dragstart')?.forEach((fn) => fn());
    listeners.get('dragend')?.forEach((fn) => fn());

    expect(onSettled).toHaveBeenCalledTimes(1);
    cleanup();
  });
});
