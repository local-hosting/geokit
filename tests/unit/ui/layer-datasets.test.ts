import { describe, expect, it } from 'vitest';
import {
  isLayerDatasetId,
  parseLayerDatasetSlugs,
  resolveLayerDatasetId,
} from '../../../src/ui/components/elements/layer/layer-datasets';

describe('layer-datasets', () => {
  it('isLayerDatasetId accepts known presets', () => {
    expect(isLayerDatasetId('state')).toBe(true);
    expect(isLayerDatasetId('county')).toBe(true);
    expect(isLayerDatasetId('dma')).toBe(true);
    expect(isLayerDatasetId('place')).toBe(true);
    expect(isLayerDatasetId('city')).toBe(true);
    expect(isLayerDatasetId('zip')).toBe(true);
    expect(isLayerDatasetId('venues')).toBe(false);
    expect(isLayerDatasetId(null)).toBe(false);
  });

  it('resolveLayerDatasetId maps city alias to place', () => {
    expect(resolveLayerDatasetId('city')).toBe('place');
    expect(resolveLayerDatasetId('place')).toBe('place');
    expect(resolveLayerDatasetId('zip')).toBe('zip');
    expect(resolveLayerDatasetId('venues')).toBeNull();
  });

  it('parseLayerDatasetSlugs splits comma-separated slugs', () => {
    expect(parseLayerDatasetSlugs('austin,houston')).toEqual(['austin', 'houston']);
    expect(parseLayerDatasetSlugs(' Austin , HOUSTON ')).toEqual(['austin', 'houston']);
    expect(parseLayerDatasetSlugs('')).toBeUndefined();
    expect(parseLayerDatasetSlugs(undefined)).toBeUndefined();
  });
});
