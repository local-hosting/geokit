import { pointInGeometry } from '@local-hosting/geokit/core';
import type { DMA } from '@local-hosting/geokit/core';
import type { UsCrosswalkTables } from '../types';
import { compactH3CellId } from '../h3/cell-id';
import { asDmaSlugOrUndefined } from '@local-hosting/geokit/core';
import { toDMA } from '../lookup/dma';
import {
  getCountyBoundaryFeatures,
  isCountyBoundariesLoaded,
} from './county-boundaries';
import {
  GEOHASH_ZIP_INDEX_PRECISION,
  geohashCellIdForLookup,
} from '../geohash/cell-id';

function lookupGeohashZips(
  geohashToZips: Readonly<Record<string, readonly string[]>>,
  geohashCell: string
): readonly string[] {
  const key = geohashCellIdForLookup(geohashCell, GEOHASH_ZIP_INDEX_PRECISION);
  const exact = geohashToZips[key];
  if (exact) return exact;
  if (key.length < GEOHASH_ZIP_INDEX_PRECISION) {
    const zips = new Set<string>();
    for (const [cell, cellZips] of Object.entries(geohashToZips)) {
      if (!cell.startsWith(key)) continue;
      for (const zip of cellZips) zips.add(zip);
    }
    return [...zips].sort();
  }
  return [];
}

function lookupGeohashDmaSlug(
  geohashToDma: Readonly<Record<string, string>>,
  geohashCell: string
): string | undefined {
  const key = geohashCellIdForLookup(geohashCell, GEOHASH_ZIP_INDEX_PRECISION);
  const exact = asDmaSlugOrUndefined(geohashToDma[key]);
  if (exact) return exact;
  if (key.length < GEOHASH_ZIP_INDEX_PRECISION) {
    const dmaSlugs = new Set<string>();
    for (const [cell, dma] of Object.entries(geohashToDma)) {
      if (!cell.startsWith(key)) continue;
      const slug = asDmaSlugOrUndefined(dma);
      if (slug) dmaSlugs.add(slug);
    }
    if (dmaSlugs.size === 1) return [...dmaSlugs][0];
  }
  return undefined;
}

export function createUsTableLookups(tables: UsCrosswalkTables) {
  const h3ToDma = tables.h3ToDma;
  const h3R5ToZips = tables.h3R5ToZips;
  const zipToH3R5 = tables.zipToH3R5;
  const geohashToDma = tables.geohashToDma;
  const geohashP8ToZips = tables.geohashP8ToZips;
  const zipToGeohashP8 = tables.zipToGeohashP8;
  const dmaToZips = tables.dmaToZips;
  const dmaToCounties = tables.dmaToCounties;
  const countyToDma = tables.countyToDma;
  const zipToState = tables.zipToState;
  const placeToDma = tables.placeToDma;
  const tractToH3R1 = tables.tractToH3R1;
  const h3R1ToTracts = tables.h3R1ToTracts;

  const lookups = {
    dmaFromH3(h3Cell: string): DMA | undefined {
      const compact = compactH3CellId(h3Cell);
      return toDMA(h3ToDma[compact]);
    },

    dmaFromPoint(lat: number, lon: number): DMA | undefined {
      if (!isCountyBoundariesLoaded()) return undefined;
      for (const feature of getCountyBoundaryFeatures()) {
        if (!feature.geometry) continue;
        if (!pointInGeometry([lat, lon], feature.geometry)) continue;
        const fromProps = asDmaSlugOrUndefined(feature.properties?.dmaSlug);
        if (fromProps) return toDMA(fromProps);
        const fips = feature.properties?.fips?.trim();
        if (fips) return toDMA(lookups.dmaSlugForCounty(fips));
      }
      return undefined;
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

    dmaFromGeohash(geohashCell: string): DMA | undefined {
      return toDMA(lookupGeohashDmaSlug(geohashToDma, geohashCell));
    },

    zipsForGeohash(geohashCell: string): readonly string[] {
      return lookupGeohashZips(geohashP8ToZips, geohashCell);
    },

    primaryZipForGeohash(geohashCell: string): string | undefined {
      const zips = lookupGeohashZips(geohashP8ToZips, geohashCell);
      return zips[0];
    },

    geohashForZip(zip: string): string | undefined {
      const key = zip.trim();
      return zipToGeohashP8[key] ?? zipToGeohashP8[key.padStart(5, '0')];
    },

    dmaFromZip(zip: string): DMA | undefined {
      const geohash = zipToGeohashP8[zip.trim()] ?? zipToGeohashP8[zip.trim().padStart(5, '0')];
      if (geohash) {
        const dma = lookupGeohashDmaSlug(geohashToDma, geohash);
        if (dma) return toDMA(dma);
      }
      const h3 = zipToH3R5[zip.trim()] ?? zipToH3R5[zip.trim().padStart(5, '0')];
      return h3 ? toDMA(h3ToDma[compactH3CellId(h3)]) : undefined;
    },

    stateForZip(zip: string): string | undefined {
      if (!zipToState) return undefined;
      const key = zip.trim();
      const state = zipToState[key] ?? zipToState[key.padStart(5, '0')];
      return state?.trim().toLowerCase();
    },

    zipsInDMA(dmaSlug: string): readonly string[] {
      const slug = asDmaSlugOrUndefined(dmaSlug);
      if (!slug) return [];
      return dmaToZips[slug] ?? [];
    },

    countiesInDMA(dmaSlug: string): readonly string[] {
      if (!dmaToCounties) return [];
      const slug = asDmaSlugOrUndefined(dmaSlug);
      if (!slug) return [];
      return dmaToCounties[slug] ?? [];
    },

    dmaSlugForCounty(fips: string): string | undefined {
      if (!countyToDma) return undefined;
      const key = fips.trim();
      return asDmaSlugOrUndefined(countyToDma[key]);
    },

    dmaFromCounty(fips: string): DMA | undefined {
      return toDMA(lookups.dmaSlugForCounty(fips));
    },

    dmaFromPlace(placeKey: string): DMA | undefined {
      if (!placeToDma) return undefined;
      const key = placeKey.trim().toLowerCase();
      const entry = placeToDma[key];
      if (!entry) return undefined;
      return toDMA(entry.dmaSlug);
    },

    dmaFromSlug(dmaSlug: string): DMA | undefined {
      return toDMA(dmaSlug);
    },

    h3ForTract(geoid: string): string | undefined {
      if (!tractToH3R1) return undefined;
      const key = geoid.trim().padStart(11, '0');
      return tractToH3R1[key] ?? tractToH3R1[geoid.trim()];
    },

    tractsForH3(h3Cell: string): readonly string[] {
      if (!h3R1ToTracts) return [];
      const compact = compactH3CellId(h3Cell);
      return h3R1ToTracts[compact] ?? h3R1ToTracts[h3Cell] ?? [];
    },
  };

  return lookups;
}

export type UsTableLookups = ReturnType<typeof createUsTableLookups>;
