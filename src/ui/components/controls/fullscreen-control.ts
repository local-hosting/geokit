/**
 * Fullscreen Control Component
 *
 * Provides a button to toggle fullscreen mode
 *
 * Usage:
 * <mapi-control-fullscreen position="top-right"></mapi-control-fullscreen>
 */

import { BaseControl } from '../base-control';

export class FullscreenControlElement extends BaseControl {
  static observedAttributes = ['position', 'container'];

  protected getDefaultPosition(): string {
    return 'top-right';
  }

  protected async createControl(): Promise<any> {
    const provider = this.getUIProvider();
    const container = this.getAttribute('container');

    const options = {
      container: container || undefined,
    };

    return provider.createControl('fullscreen', options);
  }

  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    this.handleRecreateableAttributeChange(name, oldValue, newValue, ['container']);
  }
}

// Register custom element
if (!customElements.get('gk-control-fullscreen')) {
  customElements.define('gk-control-fullscreen', FullscreenControlElement);
}
