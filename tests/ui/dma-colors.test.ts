import { describe, expect, it } from 'vitest';
import {
  buildDmaSlugColorExpression,
  getDMAColor,
  DMA_H2_GRID_FILL,
  DMA_H2_UNASSIGNED_SLUG,
  DMA_FALLBACK_NEUTRAL,
} from '../../src/ui/utils/dma-colors';

describe('geokit/ui dma-colors', () => {
  it('builds match expression from market slugs', () => {
    const expr = buildDmaSlugColorExpression([{ slug: 'louisville', region: 'mid-south' }]);
    expect(expr).toEqual([
      'match',
      ['get', 'slug'],
      'louisville',
      getDMAColor('louisville', 'mid-south'),
      DMA_H2_UNASSIGNED_SLUG,
      DMA_H2_GRID_FILL,
      DMA_FALLBACK_NEUTRAL,
    ]);
  });
});
