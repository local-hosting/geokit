/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { createLayerTogglesControl } from '../../../src/components/controls/create-layer-toggles-control';

describe('createLayerTogglesControl', () => {
  it('stacks terrain above saved scope in one ctrl-group', () => {
    const mapEl = document.createElement('div');
    const control = createLayerTogglesControl({ getMapElement: () => mapEl });
    const root = control.onAdd({});
    expect(root.querySelectorAll('button')).toHaveLength(2);
    const buttons = [...root.querySelectorAll('button')] as HTMLButtonElement[];
    expect(buttons[0]?.classList.contains('maplibregl-ctrl-terrain')).toBe(true);
    expect(buttons[1]?.classList.contains('gk-ctrl-saved-scope')).toBe(true);
  });

  it('dispatches toggle ids independently', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('terrain-enabled', 'false');
    mapEl.setAttribute('saved-scope-enabled', 'true');
    const onChange = vi.fn();
    const control = createLayerTogglesControl({ getMapElement: () => mapEl, onChange });
    const buttons = [...control.onAdd({}).querySelectorAll('button')] as HTMLButtonElement[];

    buttons[1]?.click();
    expect(onChange).toHaveBeenCalledWith('savedScope', false);
    buttons[0]?.click();
    expect(onChange).toHaveBeenCalledWith('terrain', true);
  });
});