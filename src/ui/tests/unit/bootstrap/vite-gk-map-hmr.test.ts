import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  freezeGkMapsForViteHmr,
  onGkMapsRestoredAfterViteHmr,
  restoreConnectedGkMapsAfterViteHmr,
  scheduleGkMapRestoreOnViteAfterUpdate,
} from '../../../src/bootstrap/vite-gk-map-hmr';

function makeRoot(maps: Array<{ connected: boolean; freeze?: () => Promise<void>; unfreeze?: () => Promise<boolean> }>) {
  const elements = maps.map((spec) => {
    const el = document.createElement('gk-map');
    if (spec.freeze) {
      (el as unknown as { freeze: () => Promise<void> }).freeze = spec.freeze;
    }
    if (spec.unfreeze) {
      (el as unknown as { unfreeze: () => Promise<boolean> }).unfreeze = spec.unfreeze;
    }
    Object.defineProperty(el, 'isConnected', {
      configurable: true,
      get: () => spec.connected,
    });
    return el;
  });
  const root = document.createElement('div');
  for (const el of elements) root.appendChild(el);
  return root;
}

describe('vite-gk-map-hmr', () => {
  it('freezes every gk-map under the root', () => {
    const freezeA = vi.fn().mockResolvedValue(undefined);
    const freezeB = vi.fn().mockResolvedValue(undefined);
    const root = makeRoot([
      { connected: true, freeze: freezeA },
      { connected: false, freeze: freezeB },
    ]);

    freezeGkMapsForViteHmr(root);

    expect(freezeA).toHaveBeenCalledOnce();
    expect(freezeB).toHaveBeenCalledOnce();
  });

  it('unfreezes only connected gk-map elements', () => {
    const unfreezeConnected = vi.fn().mockResolvedValue(true);
    const unfreezeDetached = vi.fn().mockResolvedValue(true);
    const root = makeRoot([
      { connected: true, unfreeze: unfreezeConnected },
      { connected: false, unfreeze: unfreezeDetached },
    ]);

    restoreConnectedGkMapsAfterViteHmr(root);

    expect(unfreezeConnected).toHaveBeenCalledOnce();
    expect(unfreezeDetached).not.toHaveBeenCalled();
  });

  it('refreshes map collections instead of unfreezing pooled gk-map children directly', () => {
    const refresh = vi.fn();
    const syncActiveCount = vi.fn();
    const collection = document.createElement('gk-map-collection') as HTMLElement & {
      refresh?: () => void;
      syncActiveCount?: () => void;
    };
    collection.refresh = refresh;
    collection.syncActiveCount = syncActiveCount;

    const poolMapUnfreeze = vi.fn().mockResolvedValue(true);
    const poolMap = document.createElement('gk-map') as HTMLElement & {
      unfreeze?: () => Promise<boolean>;
    };
    poolMap.unfreeze = poolMapUnfreeze;
    collection.appendChild(poolMap);

    const standaloneUnfreeze = vi.fn().mockResolvedValue(true);
    const standalone = document.createElement('gk-map') as HTMLElement & {
      unfreeze?: () => Promise<boolean>;
    };
    standalone.unfreeze = standaloneUnfreeze;
    Object.defineProperty(standalone, 'isConnected', {
      configurable: true,
      get: () => true,
    });

    const root = document.createElement('div');
    root.appendChild(collection);
    root.appendChild(standalone);

    restoreConnectedGkMapsAfterViteHmr(root);

    expect(syncActiveCount).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(poolMapUnfreeze).not.toHaveBeenCalled();
    expect(standaloneUnfreeze).toHaveBeenCalledOnce();
  });
});

describe('scheduleGkMapRestoreOnViteAfterUpdate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces vite:afterUpdate into restore and notifies listeners', () => {
    const listeners = new Map<string, () => void>();
    const hot = {
      on: (event: string, cb: () => void) => {
        listeners.set(event, cb);
      },
    };

    const standaloneUnfreeze = vi.fn().mockResolvedValue(true);
    const standalone = document.createElement('gk-map') as HTMLElement & {
      unfreeze?: () => Promise<boolean>;
    };
    standalone.unfreeze = standaloneUnfreeze;
    Object.defineProperty(standalone, 'isConnected', {
      configurable: true,
      get: () => true,
    });
    document.body.appendChild(standalone);

    const notified = vi.fn();
    onGkMapsRestoredAfterViteHmr(notified);

    scheduleGkMapRestoreOnViteAfterUpdate(hot);
    listeners.get('vite:afterUpdate')?.();
    expect(standaloneUnfreeze).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(standaloneUnfreeze).toHaveBeenCalledOnce();
    expect(notified).toHaveBeenCalledOnce();

    document.body.removeChild(standalone);
  });
});
