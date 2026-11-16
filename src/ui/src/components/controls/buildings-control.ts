/**
 * Buildings Control Component
 *
 * Toggle 3D building extrusions via parent `gk-map` `buildings-enabled`.
 * Requires `buildings-min-zoom` on the map for extrusions to render.
 *
 * Usage:
 * <gk-control-buildings position="bottom-left"></gk-control-buildings>
 *
 * Dispatches bubbling `change` with `detail: { enabled: boolean }` after toggle.
 */

import { BaseControl } from '../base-control';
import { createBuildingsToggleControl } from './create-buildings-toggle-control';

export class BuildingsControlElement extends BaseControl {
  static observedAttributes = ['position'];

  protected getDefaultPosition(): string {
    return 'bottom-right';
  }

  protected async createControl(): Promise<ReturnType<typeof createBuildingsToggleControl>> {
    return createBuildingsToggleControl({
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

if (!customElements.get('gk-control-buildings')) {
  customElements.define('gk-control-buildings', BuildingsControlElement);
}
