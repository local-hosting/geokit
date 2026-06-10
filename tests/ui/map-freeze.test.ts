import { describe, expect, it } from 'vitest';
import {
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
} from '../../src/ui/components/elements/map/map-freeze';

describe('map-freeze WebGL budget', () => {
  it('caps pool size to stay within the WebGL context budget', () => {
    const budgetCap = Math.floor(WEBGL_CONTEXT_BUDGET / WEBGL_CONTEXTS_PER_MAP);
    expect(getMaxActiveMaps(10)).toBe(budgetCap);
    expect(getMaxActiveMaps(1)).toBe(1);
    expect(getMaxActiveMaps(0)).toBe(1);
  });
});
