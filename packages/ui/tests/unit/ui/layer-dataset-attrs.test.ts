/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import {
  collectPassthroughDatasetAttrs,
  isPassthroughDatasetAttr,
  CORE_GK_LAYER_ATTRS,
} from '../../../src/components/elements/layer/layer-dataset-attrs.js';

describe('layer-dataset-attrs', () => {
  it('forwards app-specific attrs without hardcoding geography names', () => {
    const el = document.createElement('div');
    el.setAttribute('layer-dataset', 'territory');
    el.setAttribute('state', 'ky');
    el.setAttribute('region', 'midwest');
    el.setAttribute('region-id', 'west');

    const attrs = collectPassthroughDatasetAttrs(el);
    expect(attrs.state).toBe('ky');
    expect(attrs['region']).toBe('midwest');
    expect(attrs['region-id']).toBe('west');
    expect(attrs['layer-dataset']).toBeUndefined();
  });

  it('treats core gk-layer attrs as non-passthrough', () => {
    expect(isPassthroughDatasetAttr('fill-opacity')).toBe(false);
    expect(isPassthroughDatasetAttr('region')).toBe(true);
    expect(CORE_GK_LAYER_ATTRS.has('layer-dataset')).toBe(true);
  });
});
