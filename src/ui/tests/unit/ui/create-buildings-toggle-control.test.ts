/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { createBuildingsToggleControl } from '../../../src/components/controls/create-buildings-toggle-control';

describe('createBuildingsToggleControl', () => {
  it('renders an icon button inside a ctrl-group', () => {
    const mapEl = document.createElement('div');
    const control = createBuildingsToggleControl({ getMapElement: () => mapEl });
    const root = control.onAdd({});
    expect(root.className).toMatch(/maplibregl-ctrl-group/);
    const button = root.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('gk-ctrl-buildings')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('3D buildings');
    const icon = button.querySelector('.maplibregl-ctrl-icon') as HTMLElement;
    expect(icon).not.toBeNull();
    expect(icon.classList.contains('mapboxgl-ctrl-icon')).toBe(true);
  });

  it('toggles buildings-enabled on the map element', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('buildings-enabled', 'false');
    const onChange = vi.fn();
    const control = createBuildingsToggleControl({ getMapElement: () => mapEl, onChange });
    const button = control.onAdd({}).querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    expect(mapEl.getAttribute('buildings-enabled')).toBe('true');
    expect(button.classList.contains('gk-ctrl-buildings-enabled')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(onChange).toHaveBeenCalledWith(true);

    button.click();
    expect(mapEl.getAttribute('buildings-enabled')).toBe('false');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('syncs pressed state when the host sets buildings-enabled', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('buildings-enabled', 'false');
    const control = createBuildingsToggleControl({ getMapElement: () => mapEl });
    const button = control.onAdd({}).querySelector('button') as HTMLButtonElement;

    mapEl.setAttribute('buildings-enabled', 'true');
    control.syncFromMap();
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
