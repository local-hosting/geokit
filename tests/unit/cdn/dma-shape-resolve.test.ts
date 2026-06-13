import { describe, expect, it, vi } from 'vitest';
import { clearDmaMarketCatalogCache } from '../../../src/cdn/dma-catalog';
import {
  dmaSlugFromQuery,
  fetchDmaMarketShapeFeature,
  resolveDmaShapeFromQuery,
} from '../../../src/cdn/dma';

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

  it('falls back to catalog prefix match when the short slug 404s', async () => {
    clearDmaMarketCatalogCache();
    const geometry: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-83, 28],
          [-82, 28],
          [-82, 29],
          [-83, 29],
          [-83, 28],
        ],
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/markets/dma/index.json')) {
        return new Response(
          JSON.stringify({
            entries: [
              {
                slug: 'tampa-st-petersburg-sarasota',
                url: '/markets/dma/tampa-st-petersburg-sarasota.json',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      if (url.includes('/markets/dma/tampa.json')) {
        return new Response(null, { status: 404 });
      }
      if (url.includes('/markets/dma/tampa-st-petersburg-sarasota.json')) {
        return new Response(
          JSON.stringify({ slug: 'tampa-st-petersburg-sarasota', name: 'Tampa', geometry }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const feature = await resolveDmaShapeFromQuery('tampa dma');
    expect(feature?.geometry).toEqual(geometry);

    fetchSpy.mockRestore();
    clearDmaMarketCatalogCache();
  });
});
