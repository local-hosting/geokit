import { describe, expect, it } from 'vitest';
import { SHARED_POINT_FLOATING_BADGE_FILL } from '../../../src/utils/paint/shared-point-paint';
import {
  sharedPointRoundedBodyLayerId,
  sharedPointRoundedOuterLayerId,
  sharedPointRoundedRingLayerId,
} from '../../../src/utils/paint/shared-point-rounded-body';
import { buildFloatingBadgeStack } from '../../../src/utils/markers/marker-stack';

describe('rounded-rect place parity stack', () => {
  const pointLayerId = 'canvas-places-point';

  it('includes outer, ring, and core rounded layers', () => {
    const stack = buildFloatingBadgeStack({
      sourceId: 'canvas-places',
      pointLayerId,
      glowLayerId: 'canvas-places-glow',
    });
    expect(stack.roundedResting).toContain(sharedPointRoundedOuterLayerId(pointLayerId));
    expect(stack.roundedResting).toContain(sharedPointRoundedRingLayerId(pointLayerId));
    expect(stack.roundedResting).toContain(sharedPointRoundedBodyLayerId(pointLayerId));
  });

  it('uses white core fill token for place-style resting core', () => {
    expect(SHARED_POINT_FLOATING_BADGE_FILL.toLowerCase()).toBe('#ffffff');
  });
});