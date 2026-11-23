import type { MapAttributeToggleControl } from './create-map-attribute-toggle-control';
import { createStackedMapAttributeTogglesControl } from './create-stacked-map-attribute-toggles-control';

export type LayerTogglesControlOptions = {
  getMapElement: () => HTMLElement | null;
  onChange?: (toggle: 'terrain' | 'savedScope', enabled: boolean) => void;
};

const TERRAIN_SPEC = {
  id: 'terrain',
  label: '3D terrain',
  attributes: ['terrain-enabled', 'hillshade-enabled'] as const,
  offClass: 'maplibregl-ctrl-terrain',
  onClass: 'maplibregl-ctrl-terrain-enabled',
};

const SAVED_SCOPE_SPEC = {
  id: 'savedScope',
  label: 'Saved location scope',
  attributes: ['saved-scope-enabled'] as const,
  offClass: 'gk-ctrl-saved-scope',
  onClass: 'gk-ctrl-saved-scope-enabled',
};

/** Terrain (top) + saved scope hex (bottom) in one MapLibre ctrl-group. */
export function createLayerTogglesControl(options: LayerTogglesControlOptions): MapAttributeToggleControl {
  return createStackedMapAttributeTogglesControl({
    getMapElement: options.getMapElement,
    toggles: [TERRAIN_SPEC, SAVED_SCOPE_SPEC],
    onChange: (id, enabled) => {
      if (id === 'terrain' || id === 'savedScope') options.onChange?.(id, enabled);
    },
  });
}