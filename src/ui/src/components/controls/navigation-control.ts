/**
 * Navigation Control Component
 *
 * Provides zoom and compass controls for map navigation
 *
 * Usage:
 * <gk-control-navigation position="top-right" show-compass="true" show-zoom="true"></gk-control-navigation>
 */

import { BaseControl } from '../base-control';

export class NavigationControlElement extends BaseControl {
  static observedAttributes = ['position', 'show-compass', 'show-zoom'];

  protected getDefaultPosition(): string {
    return 'top-right';
  }

  protected async createControl(): Promise<any> {
    const provider = this.getUIProvider();
    const options = {
      showCompass: this.getBooleanAttribute('show-compass', false, true),
      showZoom: this.getBooleanAttribute('show-zoom', false, true),
    };

    return provider.createControl('navigation', options);
  }

  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    this.handleRecreateableAttributeChange(name, oldValue, newValue, ['show-compass', 'show-zoom']);
  }
}

// Register custom element
if (!customElements.get('gk-control-navigation')) {
  customElements.define('gk-control-navigation', NavigationControlElement);
}
