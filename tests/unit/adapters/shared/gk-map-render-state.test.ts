import { describe, expect, it } from 'vitest';
import {
  getGkMapInstance,
  isGkMapRenderable,
} from '../../../../src/adapters/shared/gk-map-render-state.js';
import type { GkMapElement } from '../../../../src/adapters/shared/types.js';

describe('gk-map-render-state', () => {
  it('getGkMapInstance returns map from element', () => {
    const el = document.createElement('gk-map') as GkMapElement;
    el.getMap = () => ({ id: 'map-1' });
    expect(getGkMapInstance(el)).toEqual({ id: 'map-1' });
  });

  it('isGkMapRenderable is true when style loaded or canvas present', () => {
    const el = document.createElement('gk-map') as GkMapElement;
    const canvas = document.createElement('canvas');
    el.appendChild(canvas);

    const withoutMap = isGkMapRenderable(el, null);
    expect(withoutMap.hasCanvas).toBe(true);
    expect(withoutMap.ready).toBe(false);

    const withStyle = isGkMapRenderable(el, { isStyleLoaded: () => true });
    expect(withStyle.styleLoaded).toBe(true);
    expect(withStyle.ready).toBe(true);
  });
});
