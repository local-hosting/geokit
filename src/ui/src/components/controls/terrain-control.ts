/**
 * Terrain Control Component
 *
 * Toggle 3D terrain + hillshade via parent `gk-map` attributes.
 * Uses MapLibre terrain button chrome (`maplibregl-ctrl-terrain` + icon).
 *
 * Does **not** call MapTiler `enableTerrain()` — that loads tiles.json without a
 * key through the geo proxy and 403s. Geokit DEM setup uses proxy-safe tile URLs.
 *
 * Usage:
 * <gk-control-terrain position="bottom-right"></gk-control-terrain>
 *
 * Dispatches bubbling `change` with `detail: { enabled: boolean }` after toggle.
 */

import { BaseControl } from '../base-control';
import { createTerrainToggleControl } from './create-terrain-toggle-control';

export class TerrainControlElement extends BaseControl {
  static observedAttributes = ['position'];

  protected getDefaultPosition(): string {
    return 'bottom-right';
  }

  protected async createControl(): Promise<ReturnType<typeof createTerrainToggleControl>> {
    return createTerrainToggleControl({
      getMapElement: () => this.mapElement,
      onChange: (enabled) => {
        this.dispatchEvent(
          new CustomEvent('change', {
            detail: { enabled },
            bubbles: true,
            composed: true,
          })
        );
      },
    });
  }
}

if (!customElements.get('gk-control-terrain')) {
  customElements.define('gk-control-terrain', TerrainControlElement);
}
