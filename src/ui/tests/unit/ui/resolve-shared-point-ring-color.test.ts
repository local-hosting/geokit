/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { resolveSharedPointRingColor } from '../../../src/utils/layers/styles/shared-point/selection';
import { sharedPointFloatingBadgeRestingColor } from '../../../src/utils/paint/shared-point-paint';

describe('resolveSharedPointRingColor', () => {
  it('prefers the vivid key over a hover-washed _color', () => {
    expect(
      resolveSharedPointRingColor(
        {
          _colorKey: '#e24b89',
          _color: '#f1a5c4',
          _colorHover: '#f1a5c4',
        },
        '#888888'
      )
    ).toBe('#e24b89');
  });

  it('does not treat a stuck hover tint as resting when _color matches _colorHover', () => {
    expect(
      resolveSharedPointRingColor(
        {
          _color: '#f1a5c4',
          _colorHover: '#f1a5c4',
        },
        '#e24b89'
      )
    ).toBe(sharedPointFloatingBadgeRestingColor('#e24b89'));
  });

  it('uses _colorResting when key is absent', () => {
    expect(
      resolveSharedPointRingColor(
        {
          _colorResting: '#e24b89',
          _color: '#f1a5c4',
        },
        '#888888'
      )
    ).toBe('#e24b89');
  });
});
