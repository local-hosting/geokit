import { describe, expect, it } from 'vitest';
import { loadUsCrosswalk, loadUsCrosswalkSync } from '../src/load/load';
import { convert, GKZip } from '../src/index.ts';
import { GeoKind, canonicalDmaSlug } from '@geokit/core';
import {
  COUNTY_TO_DMA,
  DMA_TO_COUNTIES,
  H3_R5_TO_ZIPS,
  H3_TO_DMA,
  GEOHASH_TO_DMA,
  GEOHASH_P8_TO_ZIPS,
  ZIP_TO_H3_R5,
} from '../generated/us/index.ts';
import { compactH3CellId } from '@geokit/core/h3';

describe('crosswalk guard (generated tables)', () => {
  it('countyToDma entries appear in dmaToCounties inverse', () => {
    let inverseMiss = 0;
    for (const [fips, dmaRaw] of Object.entries(COUNTY_TO_DMA)) {
      const dma = canonicalDmaSlug(dmaRaw);
      const list = DMA_TO_COUNTIES[dma] ?? [];
      if (!list.includes(fips)) inverseMiss += 1;
    }
    expect(inverseMiss).toBe(0);
  });

  it('reports h3-r5 cells missing h3-to-dma (compact keys)', () => {
    let missing = 0;
    for (const raw of Object.keys(H3_R5_TO_ZIPS)) {
      const compact = compactH3CellId(raw);
      if (H3_TO_DMA[compact] || H3_TO_DMA[raw]) continue;
      missing += 1;
    }
    // Guard surfaces gaps — tighten to 0 once codegen enrich covers all cells
    expect(missing).toBe(0);
  });

  it('geohash-to-dma matches zip→h3→dma chain when tables present', () => {
    if (Object.keys(GEOHASH_TO_DMA).length === 0) return;
    let mismatch = 0;
    for (const [geohash, dmaRaw] of Object.entries(GEOHASH_TO_DMA)) {
      const tabular = canonicalDmaSlug(dmaRaw);
      const zips = GEOHASH_P8_TO_ZIPS[geohash] ?? [];
      let via: string | null = null;
      for (const zip of zips) {
        const h3 = ZIP_TO_H3_R5[zip] ?? ZIP_TO_H3_R5[zip.padStart(5, '0')];
        if (!h3) continue;
        const slug = H3_TO_DMA[compactH3CellId(h3)] ?? H3_TO_DMA[h3];
        if (slug) {
          via = canonicalDmaSlug(slug);
          break;
        }
      }
      if (via && via !== tabular) mismatch += 1;
    }
    expect(mismatch).toBe(0);
  });

  it('runtime convert(indianapolis zip) resolves DMA from bundled tables', async () => {
    await loadUsCrosswalk({ tables: ['zipToH3R5', 'h3R5ToZips', 'h3ToDma', 'geohashP8ToZips', 'geohashToDma', 'zipToGeohashP8'], spine: 'geohash', projectH3: false });
    const dma = convert(GKZip('46204'), GeoKind.DMA);
    expect(dma?.slug).toBe('indianapolis');
  });
});
