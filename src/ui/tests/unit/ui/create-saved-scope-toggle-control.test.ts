/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { createSavedScopeToggleControl } from '../../../src/components/controls/create-saved-scope-toggle-control';

describe('createSavedScopeToggleControl', () => {
  it('renders an icon button inside a ctrl-group', () => {
    const mapEl = document.createElement('div');
    const control = createSavedScopeToggleControl({ getMapElement: () => mapEl });
    const root = control.onAdd({});
    expect(root.className).toMatch(/maplibregl-ctrl-group/);
    const button = root.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('gk-ctrl-saved-scope')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Saved location scope');
  });

  it('toggles saved-scope-enabled on the map element', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('saved-scope-enabled', 'false');
    const onChange = vi.fn();
    const control = createSavedScopeToggleControl({ getMapElement: () => mapEl, onChange });
    const button = control.onAdd({}).querySelector('button') as HTMLButtonElement;

    button.click();
    expect(mapEl.getAttribute('saved-scope-enabled')).toBe('true');
    expect(button.classList.contains('gk-ctrl-saved-scope-enabled')).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});