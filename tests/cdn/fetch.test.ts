import { describe, expect, it } from 'vitest';
import { resolveGlobeCdnRequestUrl } from '../../src/cdn/fetch';
import { GLOBE_CDN_DEV_PROXY_PREFIX } from '../../src/cdn/dev-proxy';

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

  it('keeps same-origin dev proxy paths unchanged', () => {
    const path = `${GLOBE_CDN_DEV_PROXY_PREFIX}/us/indexes/states.json`;
    expect(resolveGlobeCdnRequestUrl(path, base)).toBe(path);
  });
});
