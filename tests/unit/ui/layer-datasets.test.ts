import { describe, expect, it } from 'vitest';
import {
  normalizeLayerDatasetId,
  parseLayerDatasetSlugs,
  resolveLayerDatasetId,
} from '../../../src/ui/components/elements/layer/layer-datasets';

describe('layer-datasets', () => {
  it('normalizeLayerDatasetId accepts any non-empty id', () => {
    expect(normalizeLayerDatasetId('state')).toBe('state');
    expect(normalizeLayerDatasetId('venues')).toBe('venues');
    expect(normalizeLayerDatasetId(null)).toBeNull();
  });

  it('normalizeLayerDatasetId maps city alias to place', () => {
    expect(normalizeLayerDatasetId('city')).toBe('place');
    expect(resolveLayerDatasetId('place')).toBe('place');
  });

  it('parseLayerDatasetSlugs splits comma-separated slugs', () => {
    expect(parseLayerDatasetSlugs('austin,houston')).toEqual(['austin', 'houston']);
    expect(parseLayerDatasetSlugs(' Austin , HOUSTON ')).toEqual(['austin', 'houston']);
    expect(parseLayerDatasetSlugs('')).toBeUndefined();
    expect(parseLayerDatasetSlugs(undefined)).toBeUndefined();
  });
});
