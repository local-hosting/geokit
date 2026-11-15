/**
 * Labeled Actions Control
 *
 * Text buttons in MapLibre ctrl-group chrome for host-specific actions.
 *
 * Usage:
 * <gk-control-actions
 *   position="bottom-right"
 *   actions='[{"id":"save","label":"Save view"}]'
 * ></gk-control-actions>
 *
 * Dispatches bubbling `action` with `detail: { id: string }`.
 */

import { BaseControl } from '../base-control';
import {
  createLabeledActionsControl,
  parseLabeledActionsAttribute,
} from './create-labeled-actions-control';

export class ActionsControlElement extends BaseControl {
  static observedAttributes = ['position', 'actions', 'aria-label'];

  protected getDefaultPosition(): string {
    return 'bottom-right';
  }

  protected async createControl(): Promise<ReturnType<typeof createLabeledActionsControl>> {
    return createLabeledActionsControl({
      getActions: () => parseLabeledActionsAttribute(this.getAttribute('actions')),
      groupLabel: this.getAttribute('aria-label') ?? 'Map actions',
      onAction: (id) => {
        this.dispatchEvent(
          new CustomEvent('action', {
            detail: { id },
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }

  protected handleAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (name === 'actions' && this.control && oldValue !== newValue) {
      const labeledControl = this.control as ReturnType<typeof createLabeledActionsControl>;
      labeledControl.rebuild?.();
      return;
    }
    this.handleRecreateableAttributeChange(name, oldValue, newValue, ['aria-label']);
  }
}

if (!customElements.get('gk-control-actions')) {
  customElements.define('gk-control-actions', ActionsControlElement);
}
