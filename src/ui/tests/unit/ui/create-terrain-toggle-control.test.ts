/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { createTerrainToggleControl } from '../../../src/components/controls/create-terrain-toggle-control';

describe('createTerrainToggleControl', () => {
  it('uses MapLibre terrain button chrome inside a ctrl-group', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('terrain-enabled', 'false');
    const control = createTerrainToggleControl({ getMapElement: () => mapEl });
    const root = control.onAdd({});
    expect(root.className).toMatch(/maplibregl-ctrl-group/);
    const button = root.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('maplibregl-ctrl-terrain')).toBe(true);
    expect(button.querySelector('.maplibregl-ctrl-icon')).not.toBeNull();
  });

  it('toggles terrain-enabled and hillshade-enabled on the map element', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('terrain-enabled', 'false');
    mapEl.setAttribute('hillshade-enabled', 'false');
    const onChange = vi.fn();

    const control = createTerrainToggleControl({
      getMapElement: () => mapEl,
      onChange,
    });
    const root = control.onAdd({});
    const button = root.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    expect(mapEl.getAttribute('terrain-enabled')).toBe('true');
    expect(mapEl.getAttribute('hillshade-enabled')).toBe('true');
    expect(button.classList.contains('maplibregl-ctrl-terrain-enabled')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(onChange).toHaveBeenCalledWith(true);

    button.click();
    expect(mapEl.getAttribute('terrain-enabled')).toBe('false');
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('syncs pressed state when the host sets terrain-enabled', () => {
    const mapEl = document.createElement('div');
    mapEl.setAttribute('terrain-enabled', 'false');
    const control = createTerrainToggleControl({ getMapElement: () => mapEl });
    const root = control.onAdd({});
    const button = root.querySelector('button') as HTMLButtonElement;

    mapEl.setAttribute('terrain-enabled', 'true');
    control.syncFromMap();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.classList.contains('maplibregl-ctrl-terrain-enabled')).toBe(true);
  });
});
