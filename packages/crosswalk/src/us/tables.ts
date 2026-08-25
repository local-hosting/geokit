import type { UsCrosswalkTables } from '../types.js';
import { compactH3CellId } from '../h3/cell-id.js';

function canonicalDmaSlug(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const slug = raw.trim().toLowerCase().replace(/\s+/g, '-');
  return slug || undefined;
}

export function createUsTableLookups(tables: UsCrosswalkTables) {
  const h3ToDma = tables.h3ToDma;
  const h3R5ToZips = tables.h3R5ToZips;
  const zipToH3R5 = tables.zipToH3R5;
  const dmaToZips = tables.dmaToZips;
  const dmaToCounties = tables.dmaToCounties;
  const countyToDma = tables.countyToDma;
  const dmaRegion = tables.dmaRegion;
  const zipToState = tables.zipToState;
  const placeToDma = tables.placeToDma;

  return {
    dmaForH3(h3Cell: string): string | undefined {
      const compact = compactH3CellId(h3Cell);
      return canonicalDmaSlug(h3ToDma[compact]);
    },

    zipsForH3(h3Cell: string): readonly string[] {
      const compact = compactH3CellId(h3Cell);
      return h3R5ToZips[compact] ?? [];
    },

    primaryZipForH3(h3Cell: string): string | undefined {
      const zips = h3R5ToZips[compactH3CellId(h3Cell)] ?? [];
      return zips[0];
    },

    h3ForZip(zip: string): string | undefined {
      const key = zip.trim();
      return zipToH3R5[key] ?? zipToH3R5[key.padStart(5, '0')];
    },

    dmaForZip(zip: string): string | undefined {
      const h3 = zipToH3R5[zip.trim()] ?? zipToH3R5[zip.trim().padStart(5, '0')];
      return h3 ? canonicalDmaSlug(h3ToDma[compactH3CellId(h3)]) : undefined;
    },

    stateForZip(zip: string): string | undefined {
      if (!zipToState) return undefined;
      const key = zip.trim();
      const state = zipToState[key] ?? zipToState[key.padStart(5, '0')];
      return state?.trim().toLowerCase();
    },

    zipsInDma(dmaSlug: string): readonly string[] {
      const slug = canonicalDmaSlug(dmaSlug);
      if (!slug) return [];
      return dmaToZips[slug] ?? [];
    },

    countiesInDma(dmaSlug: string): readonly string[] {
      if (!dmaToCounties) return [];
      const slug = canonicalDmaSlug(dmaSlug);
      if (!slug) return [];
      return dmaToCounties[slug] ?? [];
    },

    dmaRegionForDma(dmaSlug: string): string | undefined {
      if (!dmaRegion) return undefined;
      const slug = canonicalDmaSlug(dmaSlug);
      if (!slug) return undefined;
      return dmaRegion[slug];
    },

    dmaForCountyFips(fips: string): string | undefined {
      if (!countyToDma) return undefined;
      const key = fips.trim();
      return canonicalDmaSlug(countyToDma[key]);
    },

    placeToDma(placeKey: string): { dmaSlug: string; region: string } | undefined {
      if (!placeToDma) return undefined;
      const key = placeKey.trim().toLowerCase();
      const entry = placeToDma[key];
      if (!entry) return undefined;
      const dmaSlug = canonicalDmaSlug(entry.dmaSlug);
      if (!dmaSlug) return undefined;
      return { dmaSlug, region: entry.region.trim().toLowerCase() };
    },
  };
}

export type UsTableLookups = ReturnType<typeof createUsTableLookups>;
