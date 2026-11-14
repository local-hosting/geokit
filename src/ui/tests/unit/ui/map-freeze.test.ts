import { describe, expect, it, afterEach } from 'vitest';
import {
  WEBGL_CONTEXTS_PER_MAP,
  WEBGL_CONTEXT_BUDGET,
  getMaxActiveMaps,
  getWebGLMapBudget,
  getLiveMapCount,
  registerLiveMap,
  unregisterLiveMap,
  canCreateAnotherMap,
  reconcileLiveMapCountFromDom,
} from '../../../src/components/elements/map/lifecycle/map-webgl-budget';

describe('map-freeze WebGL budget', () => {
  afterEach(() => {
    while (getLiveMapCount() > 0) unregisterLiveMap();
    reconcileLiveMapCountFromDom(document);
  });

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

  it('reconciles a leaked liveMapCount when the DOM has no live maps', () => {
    const budget = getWebGLMapBudget();
    for (let i = 0; i < budget; i += 1) registerLiveMap();
    expect(canCreateAnotherMap()).toBe(false);

    const root = document.createElement('div');
    root.innerHTML = '<gk-map></gk-map>';
    expect(reconcileLiveMapCountFromDom(root)).toBe(0);
    expect(getLiveMapCount()).toBe(0);
    expect(canCreateAnotherMap()).toBe(true);
  });

  it('counts connected gk-map hosts that still hold a map instance', () => {
    registerLiveMap();
    registerLiveMap();
    expect(getLiveMapCount()).toBe(2);

    const root = document.createElement('div');
    const live = document.createElement('gk-map') as HTMLElement & {
      map?: unknown;
      _registeredForWebGLBudget?: boolean;
    };
    live.map = {};
    live._registeredForWebGLBudget = true;
    root.appendChild(live);
    root.appendChild(document.createElement('gk-map'));

    expect(reconcileLiveMapCountFromDom(root)).toBe(1);
    expect(getLiveMapCount()).toBe(1);
  });
});
