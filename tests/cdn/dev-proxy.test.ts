import { describe, expect, it } from 'vitest';
import { rewriteGlobeCdnUrlForDevProxy } from '../../src/cdn/dev-proxy';

describe('rewriteGlobeCdnUrlForDevProxy', () => {
  const cdnBaseUrl = 'https://globe.example.test';

  it('rewrites globe CDN URLs to the dev proxy prefix', () => {
    expect(
      rewriteGlobeCdnUrlForDevProxy('https://globe.example.test/us/indexes/counties.json', {
        enabled: true,
        cdnBaseUrl,
      })
    ).toBe('/__globe-cdn/us/indexes/counties.json');
  });

  it('leaves non-CDN URLs unchanged', () => {
    const url = 'https://api.maptiler.com/tiles.json';
    expect(rewriteGlobeCdnUrlForDevProxy(url, { enabled: true, cdnBaseUrl })).toBe(url);
  });

  it('leaves URLs unchanged when disabled', () => {
    const url = 'https://globe.example.test/us/indexes/states.json';
    expect(rewriteGlobeCdnUrlForDevProxy(url, { enabled: false, cdnBaseUrl })).toBe(url);
  });
});
