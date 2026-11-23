/**
 * Saved scope control — toggles host-rendered pack H3 hex overlays via `saved-scope-enabled`.
 *
 * Usage:
 * <gk-control-saved-scope position="bottom-left"></gk-control-saved-scope>
 *
 * Dispatches bubbling `change` with `detail: { enabled: boolean }` after toggle.
 */

import { BaseControl } from '../base-control';
import { createSavedScopeToggleControl } from './create-saved-scope-toggle-control';

export class SavedScopeControlElement extends BaseControl {
  static observedAttributes = ['position'];

  protected getDefaultPosition(): string {
    return 'bottom-left';
  }

  protected async createControl(): Promise<ReturnType<typeof createSavedScopeToggleControl>> {
    return createSavedScopeToggleControl({
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

if (!customElements.get('gk-control-saved-scope')) {
  customElements.define('gk-control-saved-scope', SavedScopeControlElement);
}