import { describe, expect, it, vi } from 'vitest';
import {
  freezeGkMapsForViteHmr,
  restoreConnectedGkMapsAfterViteHmr,
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
});
