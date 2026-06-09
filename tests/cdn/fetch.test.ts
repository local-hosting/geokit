import { describe, expect, it } from 'vitest';
import { resolveGlobeCdnRequestUrl } from '../../src/cdn/fetch';

describe('resolveGlobeCdnRequestUrl', () => {
  const base = 'https://mapto.link';

  it('resolves root-relative paths against the CDN base', () => {
    expect(resolveGlobeCdnRequestUrl('/us/indexes/counties.json', base)).toBe(
      `${base}/us/indexes/counties.json`
    );
  });

  it('keeps absolute http(s) URLs unchanged', () => {
    const url = 'https://other.example.test/us/county/36047';
    expect(resolveGlobeCdnRequestUrl(url, base)).toBe(url);
  });

  it('uses same-origin relative paths when base is empty', () => {
    expect(resolveGlobeCdnRequestUrl('/markets/dma/regions/texas-la.json', '')).toBe(
      '/markets/dma/regions/texas-la.json'
    );
  });
});
