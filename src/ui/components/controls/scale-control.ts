/**
 * Scale Control Component
 *
 * Displays a distance scale on the map
 *
 * Usage:
 * <mapi-control-scale position="bottom-left" unit="metric"></mapi-control-scale>
 */

import { BaseControl } from '../base-control';

export class ScaleControlElement extends BaseControl {
  static observedAttributes = ['position', 'unit'];

  protected getDefaultPosition(): string {
    return 'bottom-left';
  }

  protected async createControl(): Promise<any> {
    const provider = this.getUIProvider();
    const unit = this.getAttribute('unit') || 'metric';

    const options = {
      unit: unit as 'metric' | 'imperial' | 'nautical',
    };

    return provider.createControl('scale', options);
  }

  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    this.handleRecreateableAttributeChange(name, oldValue, newValue, ['unit']);
  }
}

// Register custom element
if (!customElements.get('gk-control-scale')) {
  customElements.define('gk-control-scale', ScaleControlElement);
}
