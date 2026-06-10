import { describe, expect, it, vi } from 'vitest';
import {
  clearDmaMarketCatalogCache,
  matchDmaSlugInCatalog,
  resolveDmaMarketFromCatalog,
} from '../../src/cdn/dma-catalog';

const FLORIDA_SLUGS = [
  'gainesville',
  'jacksonville',
  'miami-fort-lauderdale',
  'orlando-daytona-beach-melbourne',
  'panama-city',
  'tallahassee-thomasville',
  'tampa-st-petersburg-sarasota',
  'west-palm-beach-fort-pierce',
];

describe('matchDmaSlugInCatalog', () => {
  it('resolves exact slugs and legacy aliases', () => {
    expect(matchDmaSlugInCatalog('louisville', ['louisville', 'lexington'])).toEqual({
      kind: 'exact',
      slug: 'louisville',
    });
    expect(matchDmaSlugInCatalog('hawaii', ['honolulu', 'miami-fort-lauderdale'])).toEqual({
      kind: 'exact',
      slug: 'honolulu',
    });
  });

  it('resolves unique prefix hints for Florida DMAs', () => {
    expect(matchDmaSlugInCatalog('tampa', FLORIDA_SLUGS)).toEqual({
      kind: 'prefix',
      slug: 'tampa-st-petersburg-sarasota',
    });
    expect(matchDmaSlugInCatalog('orlando', FLORIDA_SLUGS)).toEqual({
      kind: 'prefix',
      slug: 'orlando-daytona-beach-melbourne',
    });
    expect(matchDmaSlugInCatalog('miami', FLORIDA_SLUGS)).toEqual({
      kind: 'prefix',
      slug: 'miami-fort-lauderdale',
    });
  });

  it('returns ambiguous when multiple slugs share a prefix', () => {
    const match = matchDmaSlugInCatalog('albany', [
      'albany-ga',
      'albany-schenectady-troy',
      'atlanta',
    ]);
    expect(match.kind).toBe('ambiguous');
    if (match.kind === 'ambiguous') {
      expect(match.slugs).toEqual(['albany-ga', 'albany-schenectady-troy']);
    }
  });

  it('returns none for unknown hints', () => {
    expect(matchDmaSlugInCatalog('not-a-market', FLORIDA_SLUGS)).toEqual({ kind: 'none' });
  });
});

describe('resolveDmaMarketFromCatalog', () => {
  it('returns canonical slug and georef region from CDN index', async () => {
    clearDmaMarketCatalogCache();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (!url.includes('/markets/dma/index.json')) {
        return new Response(null, { status: 404 });
      }
      return new Response(
        JSON.stringify({
          entries: [
            {
              slug: 'tampa-st-petersburg-sarasota',
              region: 'southeast',
              url: '/markets/dma/tampa-st-petersburg-sarasota.json',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });

    await expect(resolveDmaMarketFromCatalog('tampa')).resolves.toEqual({
      slug: 'tampa-st-petersburg-sarasota',
      region: 'southeast',
    });

    fetchSpy.mockRestore();
    clearDmaMarketCatalogCache();
  });
});
