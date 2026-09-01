import { describe, expect, it } from 'vitest';
import {
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
  getWebGLMapBudget,
  registerLiveMap,
  unregisterLiveMap,
  canCreateAnotherMap,
} from '../../../src/components/elements/map/map-freeze';

describe('map-freeze WebGL budget', () => {
  it('caps pool size to stay within the WebGL context budget', () => {
    const budgetCap = getWebGLMapBudget();
    expect(getMaxActiveMaps(10)).toBe(budgetCap);
    expect(getMaxActiveMaps(1)).toBe(1);
    expect(getMaxActiveMaps(0)).toBe(1);
    expect(budgetCap).toBe(Math.floor(WEBGL_CONTEXT_BUDGET / WEBGL_CONTEXTS_PER_MAP));
  });

  it('tracks live map instances for budget enforcement', () => {
    expect(canCreateAnotherMap()).toBe(true);
    registerLiveMap();
    registerLiveMap();
    expect(canCreateAnotherMap()).toBe(getWebGLMapBudget() > 2);
    unregisterLiveMap();
    unregisterLiveMap();
    expect(canCreateAnotherMap()).toBe(true);
  });
});
