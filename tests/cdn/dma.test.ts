import { describe, expect, it, vi } from 'vitest';
import { dmaSlugFromQuery, fetchDmaMarketShapeFeature } from '../../src/cdn/dma';

describe('cdn/dma', () => {
  it('parses DMA slugs from common query shapes', () => {
    expect(dmaSlugFromQuery('Louisville DMA')).toBe('louisville');
    expect(dmaSlugFromQuery('DMA: louisville')).toBe('louisville');
    expect(dmaSlugFromQuery('Austin TX')).toBeNull();
    expect(dmaSlugFromQuery('Hawaii DMA')).toBe('honolulu');
  });

  it('wraps Nielsen CDN { slug, name, geometry } payloads as GeoJSON features', async () => {
    const geometry: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-74, 40],
          [-73, 40],
          [-73, 41],
          [-74, 41],
          [-74, 40],
        ],
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ slug: 'new-york', name: 'New York', geometry }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const feature = await fetchDmaMarketShapeFeature('new-york');
    expect(feature?.type).toBe('Feature');
    expect(feature?.geometry).toEqual(geometry);
    expect(feature?.properties).toEqual({ slug: 'new-york', name: 'New York' });

    fetchSpy.mockRestore();
  });
});
