import {
  createMapAttributeToggleControl,
  type MapAttributeToggleControl,
  type MapAttributeToggleControlOptions,
} from './create-map-attribute-toggle-control';

export type SavedScopeToggleControlOptions = Pick<
  MapAttributeToggleControlOptions,
  'getMapElement' | 'onChange'
> & {
  /** Accessible name for the button. */
  label?: string;
};

export type SavedScopeToggleControl = MapAttributeToggleControl;

/**
 * IControl toggling `saved-scope-enabled` on the parent map. Hosts style the icon via
 * `button.gk-ctrl-saved-scope` / `button.gk-ctrl-saved-scope-enabled`.
 */
export function createSavedScopeToggleControl(
  options: SavedScopeToggleControlOptions
): SavedScopeToggleControl {
  return createMapAttributeToggleControl({
    ...options,
    label: options.label ?? 'Saved location scope',
    attributes: ['saved-scope-enabled'],
    offClass: 'gk-ctrl-saved-scope',
    onClass: 'gk-ctrl-saved-scope-enabled',
  });
}