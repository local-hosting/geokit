import {
  createMapAttributeToggleControl,
  type MapAttributeToggleControl,
  type MapAttributeToggleControlOptions,
} from './create-map-attribute-toggle-control';

export type BuildingsToggleControlOptions = Pick<
  MapAttributeToggleControlOptions,
  'getMapElement' | 'onChange'
> & {
  /** Accessible name for the button. */
  label?: string;
};

export type BuildingsToggleControl = MapAttributeToggleControl;

/**
 * IControl toggling `buildings-enabled` on the parent map. Hosts style the icon via
 * `button.gk-ctrl-buildings` / `button.gk-ctrl-buildings-enabled`.
 * Extrusions only render when the map also sets `buildings-min-zoom`.
 */
export function createBuildingsToggleControl(
  options: BuildingsToggleControlOptions
): BuildingsToggleControl {
  return createMapAttributeToggleControl({
    ...options,
    label: options.label ?? '3D buildings',
    attributes: ['buildings-enabled'],
    offClass: 'gk-ctrl-buildings',
    onClass: 'gk-ctrl-buildings-enabled',
  });
}
