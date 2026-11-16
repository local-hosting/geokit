import {
  createMapAttributeToggleControl,
  type MapAttributeToggleControl,
  type MapAttributeToggleControlOptions,
} from './create-map-attribute-toggle-control';

export type TerrainToggleControlOptions = Pick<
  MapAttributeToggleControlOptions,
  'getMapElement' | 'onChange'
> & {
  /** Accessible name for the button. */
  label?: string;
};

export type TerrainToggleControl = MapAttributeToggleControl;

/**
 * Fallback IControl (Mapbox / MapLibre) matching MapTiler terrain button DOM:
 * `maplibregl-ctrl-group` + `maplibregl-ctrl-terrain` + `maplibregl-ctrl-icon`.
 */
export function createTerrainToggleControl(
  options: TerrainToggleControlOptions
): TerrainToggleControl {
  return createMapAttributeToggleControl({
    ...options,
    label: options.label ?? '3D terrain',
    attributes: ['terrain-enabled', 'hillshade-enabled'],
    offClass: 'maplibregl-ctrl-terrain',
    onClass: 'maplibregl-ctrl-terrain-enabled',
  });
}
