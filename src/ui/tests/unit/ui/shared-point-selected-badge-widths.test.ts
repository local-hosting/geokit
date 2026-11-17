import { afterEach, describe, expect, it } from 'vitest';

import { buildFloatingBadgeSelectedChromeSpec } from '../../../src/utils/markers/marker-selection-chrome';
import {
  resolveSharedPointFloatingBadgeTokens,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgeRingWidthExpression,
} from '../../../src/utils/shared-point-paint';

function setVars(vars: Record<string, string>): void {
  for (const [name, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(name, value);
  }
}

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('selected badge widths', () => {
  it('defaults selected outer independently of resting outer', () => {
    setVars({ '--gk-badge-ring-width': '9', '--gk-badge-outer-stroke-width': '2.5' });
    const tokens = resolveSharedPointFloatingBadgeTokens();
    expect(tokens.outerStrokeWidth).toBe(2.5);
    expect(tokens.selectedRingWidth).toBe(9);
    expect(tokens.selectedOuterStrokeWidth).toBe(3);
  });

  it('can be tuned apart from the resting badge', () => {
    setVars({
      '--gk-badge-ring-width': '10',
      '--gk-badge-outer-stroke-width': '3',
      '--gk-badge-selected-ring-width': '7',
      '--gk-badge-selected-outer-stroke-width': '7',
    });
    const tokens = resolveSharedPointFloatingBadgeTokens();
    expect(tokens.coloredRingWidth).toBe(10);
    expect(tokens.outerStrokeWidth).toBe(3);
    expect(tokens.selectedRingWidth).toBe(7);
    expect(tokens.selectedOuterStrokeWidth).toBe(7);

    const spec = buildFloatingBadgeSelectedChromeSpec('#908ac7');
    expect(spec.ringWidth).toEqual(sharedPointFloatingBadgeRingWidthExpression(7));
    expect(spec.outerStrokeWidth).toBe(7);
    expect(spec.outerStrokeWidthExpression).toEqual(
      sharedPointFloatingBadgeOuterStrokeWidthExpression(7)
    );
  });
});
