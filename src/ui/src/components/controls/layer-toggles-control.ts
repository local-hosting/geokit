/**
 * Combined bottom-left map toggles: 3D terrain (top) + saved scope hex (bottom).
 *
 * <gk-control-layer-toggles position="bottom-left"></gk-control-layer-toggles>
 *
 * `change` → `detail: { toggle: 'terrain' | 'savedScope', enabled: boolean }`
 */

import { BaseControl } from '../base-control';
import { createLayerTogglesControl } from './create-layer-toggles-control';

export class LayerTogglesControlElement extends BaseControl {
  static observedAttributes = ['position'];

  protected getDefaultPosition(): string {
    return 'bottom-left';
  }

  protected async createControl(): Promise<ReturnType<typeof createLayerTogglesControl>> {
    return createLayerTogglesControl({
      getMapElement: () => this.mapElement,
      onChange: (toggle, enabled) => {
        this.dispatchEvent(
          new CustomEvent('change', {
            detail: { toggle, enabled },
            bubbles: true,
            composed: true,
          })
        );
      },
    });
  }
}

if (!customElements.get('gk-control-layer-toggles')) {
  customElements.define('gk-control-layer-toggles', LayerTogglesControlElement);
}