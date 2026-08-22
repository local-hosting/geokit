import { describe, expect, it } from 'vitest';
import { createGkMapStyle } from '../../../../src/adapters/svelte/createGkMapStyle.js';
import type { GkMapElement } from '../../../../src/adapters/shared/types.js';

describe('createGkMapStyle', () => {
  it('sync sets map-style attribute on gk-map element', () => {
    const el = document.createElement('gk-map') as GkMapElement;
    const style = createGkMapStyle(() => el, () => 'maptiler://dark');
    style.sync();
    expect(el.getAttribute('map-style')).toBe('maptiler://dark');
  });
});
