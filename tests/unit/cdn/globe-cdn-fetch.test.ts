import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGlobeCdnJson,
  registerGlobeCdnBytesObserver,
  resolveGlobeCdnRequestUrl,
  syncPublishedCellLayerIds,
} from '../../../src/cdn/fetch';

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

  it('does not rebase dev proxy paths onto the remote CDN origin', () => {
    expect(resolveGlobeCdnRequestUrl('/__globe-cdn/markets/dma/regions/index.json', base)).toBe(
      '/__globe-cdn/markets/dma/regions/index.json'
    );
  });
});

describe('fetchGlobeCdnJson bytes observer', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    syncPublishedCellLayerIds(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies observers with utf-8 payload size', async () => {
    const observer = vi.fn();
    const unregister = registerGlobeCdnBytesObserver(observer);
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const result = await fetchGlobeCdnJson<{ ok: boolean }>(
      'https://cdn.test/us/indexes/states.json'
    );

    expect(result).toEqual({ ok: true });
    expect(observer).toHaveBeenCalledWith({
      url: 'https://cdn.test/us/indexes/states.json',
      bytes: 11,
    });
    unregister();
  });
});
