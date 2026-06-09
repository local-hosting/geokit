import { describe, expect, it } from 'vitest';
import {
  buildDmaHighlightOutlineColorExpression,
  buildDmaLineOpacityExpression,
  buildDmaSlugColorExpression,
  getDMAColor,
  DMA_H2_GRID_FILL,
  DMA_H2_UNASSIGNED_SLUG,
  DMA_FALLBACK_NEUTRAL,
} from '../../src/ui/utils/dma-colors';

describe('geokit/ui dma-colors', () => {
  it('hides DMA outlines unless highlighted or line-color is set', () => {
    expect(buildDmaLineOpacityExpression({ showAllOutlines: true })).toBe(1);
    expect(buildDmaLineOpacityExpression({ showAllOutlines: false })).toEqual([
      'case',
      ['boolean', ['feature-state', 'highlight'], false],
      0.85,
      0,
    ]);
    expect(buildDmaHighlightOutlineColorExpression('#aabbcc')).toEqual([
      'case',
      ['boolean', ['feature-state', 'highlight'], false],
      '#aabbcc',
      'rgba(0, 0, 0, 0)',
    ]);
  });

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
