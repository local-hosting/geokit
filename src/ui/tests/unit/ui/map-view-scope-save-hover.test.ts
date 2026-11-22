/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';

import { bindMapViewScopeSaveHover } from '../../../src/map-view-scope/bind-map-view-scope-save-hover';

describe('bindMapViewScopeSaveHover', () => {
  it('toggles hover when the save action control is entered and left', () => {
    const host = document.createElement('div');
    const save = document.createElement('button');
    save.setAttribute('data-action-id', 'save');
    host.appendChild(save);
    const onHover = vi.fn();
    const unbind = bindMapViewScopeSaveHover(host, onHover);
    save.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(onHover).toHaveBeenLastCalledWith(true);
    save.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }),
    );
    expect(onHover).toHaveBeenLastCalledWith(false);
    unbind();
  });

  it('clears hover when the pointer leaves the browser (document mouseout)', () => {
    const host = document.createElement('div');
    const save = document.createElement('button');
    save.setAttribute('data-action-id', 'save');
    host.appendChild(save);
    const onHover = vi.fn();
    const unbind = bindMapViewScopeSaveHover(host, onHover);
    save.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(onHover).toHaveBeenLastCalledWith(true);
    document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }));
    expect(onHover).toHaveBeenLastCalledWith(false);
    unbind();
  });

  it('ignores other action buttons', () => {
    const host = document.createElement('div');
    const snap = document.createElement('button');
    snap.setAttribute('data-action-id', 'snap');
    host.appendChild(snap);
    const onHover = vi.fn();
    const unbind = bindMapViewScopeSaveHover(host, onHover);
    snap.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(onHover).not.toHaveBeenCalled();
    unbind();
  });
});