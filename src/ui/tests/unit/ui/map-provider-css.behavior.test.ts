import { afterEach, describe, expect, it } from 'vitest';

import {
  isMapboxGlCssApplied,
  isMapboxGlCssLoaded,
  waitForMapboxGlCssApplied,
} from '../../../src/utils/map-provider-css';

const CANARY_STYLE_ID = 'test-mapbox-gl-canary-style';

function injectMapboxCanaryRule(): void {
  const style = document.createElement('style');
  style.id = CANARY_STYLE_ID;
  style.textContent = '.mapboxgl-canary { background-color: rgb(250, 128, 114); }';
  document.head.appendChild(style);
}

function removeMapboxCanaryRule(): void {
  document.getElementById(CANARY_STYLE_ID)?.remove();
}

describe('map-provider-css (Mapbox canary)', () => {
  afterEach(() => {
    removeMapboxCanaryRule();
  });

  it('isMapboxGlCssApplied mirrors Mapbox runtime CSS detection', () => {
    expect(isMapboxGlCssApplied()).toBe(false);
    injectMapboxCanaryRule();
    expect(isMapboxGlCssApplied()).toBe(true);
    expect(isMapboxGlCssLoaded()).toBe(true);
  });

  it('waitForMapboxGlCssApplied resolves after injected CSS becomes active', async () => {
    removeMapboxCanaryRule();
    const done = waitForMapboxGlCssApplied(2000);
    queueMicrotask(injectMapboxCanaryRule);
    await done;
    expect(isMapboxGlCssApplied()).toBe(true);
  });
});