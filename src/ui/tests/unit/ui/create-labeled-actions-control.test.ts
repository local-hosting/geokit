/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import {
  createLabeledActionsControl,
  type LabeledAction,
} from '../../../src/components/controls/create-labeled-actions-control';

const sampleActions: LabeledAction[] = [
  { id: 'save', label: 'Save view' },
  { id: 'snap', label: 'Snap back' },
];

describe('createLabeledActionsControl', () => {
  it('uses MapLibre ctrl-group chrome with labeled action buttons', () => {
    const control = createLabeledActionsControl({ getActions: () => sampleActions });
    const root = control.onAdd({});
    expect(root.className).toMatch(/maplibregl-ctrl-group/);
    const buttons = root.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toBe('Save view');
    expect(buttons[0]?.classList.contains('gk-ctrl-action')).toBe(true);
    expect(buttons[0]?.getAttribute('data-action-id')).toBe('save');
    expect(buttons[1]?.getAttribute('data-action-id')).toBe('snap');
  });

  it('renders icon chrome when an action includes icon', () => {
    const actions: LabeledAction[] = [
      { id: 'save', label: 'Save map position', icon: 'save' },
      { id: 'snap', label: 'Snap back to saved position', icon: 'snap' },
    ];
    const control = createLabeledActionsControl({ getActions: () => actions });
    const root = control.onAdd({});
    const saveBtn = root.querySelector('[data-action-id="save"]') as HTMLButtonElement;
    const snapBtn = root.querySelector('[data-action-id="snap"]') as HTMLButtonElement;
    expect(saveBtn.classList.contains('gk-ctrl-action-icon--save')).toBe(true);
    expect(saveBtn.textContent).toBe('');
    expect(saveBtn.title).toBe('Save map position');
    expect(saveBtn.getAttribute('aria-label')).toBe('Save map position');
    expect(snapBtn.title).toBe('Snap back to saved position');
    expect(snapBtn.getAttribute('aria-label')).toBe('Snap back to saved position');
    expect(saveBtn.querySelector('.maplibregl-ctrl-icon')).not.toBeNull();
  });

  it('invokes onAction with the action id when a button is clicked', () => {
    const onAction = vi.fn();
    const control = createLabeledActionsControl({
      getActions: () => sampleActions,
      onAction,
    });
    const root = control.onAdd({});
    const saveBtn = root.querySelector('[data-action-id="save"]') as HTMLButtonElement;
    saveBtn.click();
    expect(onAction).toHaveBeenCalledWith('save');
  });
});
