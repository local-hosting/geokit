/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';

import {
  clearGkMapChildInteractiveAttribute,
  syncGkH3PaintAttributes,
  syncGkMapChildAttributes,
} from '../../../src/utils/sync-gk-map-child-attributes';

describe('syncGkMapChildAttributes', () => {
  it('sets string attributes on a map child CE', () => {
    const el = document.createElement('gk-h3');
    syncGkMapChildAttributes(el, {
      color: '#04a86d',
      opacity: 0.42,
      'stroke-color': '#04a86d',
      'stroke-width': 2.5,
    });
    expect(el.getAttribute('color')).toBe('#04a86d');
    expect(el.getAttribute('opacity')).toBe('0.42');
    expect(el.getAttribute('stroke-color')).toBe('#04a86d');
    expect(el.getAttribute('stroke-width')).toBe('2.5');
    clearGkMapChildInteractiveAttribute(el);
    expect(el.getAttribute('interactive')).toBeNull();
  });

  it('syncGkH3PaintAttributes maps camelCase paint to gk-h3 attrs', () => {
    const el = document.createElement('gk-h3');
    syncGkH3PaintAttributes(el, {
      color: '#04a86d',
      opacity: 0.42,
      strokeColor: '#04a86d',
      strokeWidth: 2.5,
    });
    expect(el.getAttribute('color')).toBe('#04a86d');
    expect(el.getAttribute('opacity')).toBe('0.42');
    expect(el.getAttribute('stroke-color')).toBe('#04a86d');
    expect(el.getAttribute('stroke-width')).toBe('2.5');
  });
});