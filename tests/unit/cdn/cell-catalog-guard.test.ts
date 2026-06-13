import { describe, expect, it } from 'vitest';
import {
  clearPublishedCellLayerIdsCache,
  fetchGlobeCdn,
  parseCellBundleIdFromPath,
  shouldFetchCellBundlePath,
  syncPublishedCellLayerIds,
} from '../../../src/cdn/fetch';

describe('cell-catalog-guard', () => {
  it('parses cell bundle paths', () => {
    expect(parseCellBundleIdFromPath('/cell/81267.json')).toBe('81267');
    expect(parseCellBundleIdFromPath('https://mapto.link/cell/82278.json')).toBe('82278');
    expect(parseCellBundleIdFromPath('/cell/layers/index.json')).toBeNull();
  });

  it('blocks unpublished cell ids after catalog sync', () => {
    clearPublishedCellLayerIdsCache();
    expect(shouldFetchCellBundlePath('/cell/82278.json')).toBe(false);

    syncPublishedCellLayerIds(new Set(['81267', '812ab']));
    expect(shouldFetchCellBundlePath('/cell/81267.json')).toBe(true);
    expect(shouldFetchCellBundlePath('/cell/82278.json')).toBe(false);
    expect(shouldFetchCellBundlePath('/cell/8126.json')).toBe(true);
    expect(shouldFetchCellBundlePath('/cell/layers/index.json')).toBe(true);
  });

  it('rewrites shorter ids to published catalog keys before fetch', async () => {
    clearPublishedCellLayerIdsCache();
    syncPublishedCellLayerIds(new Set(['81267']));

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await fetchGlobeCdn('https://mapto.link/cell/8126.json');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://mapto.link/cell/81267.json',
        expect.any(Object)
      );
    } finally {
      vi.unstubAllGlobals();
      clearPublishedCellLayerIdsCache();
    }
  });
});

import { vi } from 'vitest';

describe('fetchGlobeCdn cell bundle guard', () => {
  it('skips network for unpublished cell ids', async () => {
    clearPublishedCellLayerIdsCache();
    syncPublishedCellLayerIds(new Set(['81267']));

    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const res = await fetchGlobeCdn('https://mapto.link/cell/82278.json');
      expect(res.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();

      await fetchGlobeCdn('https://mapto.link/cell/81267.json');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      clearPublishedCellLayerIdsCache();
    }
  });
});
