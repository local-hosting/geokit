import { asDmaSlugOrUndefined } from '@twinfile/geokit/core';
import { getUsCrosswalkTables, requireUsCrosswalkLookups } from '../load/registry';
import type { UsCrosswalkTables } from '../types';
import type { UsCrosswalkTableName } from './table-names';
import { canonicalDmaSlug, slugToDmaDisplayName } from './dma-labels';

export type CountyDmaAssignment = {
  dmaSlug: string;
  dmaName: string;
};

export function requireUsCrosswalkTables(): UsCrosswalkTables {
  const tables = getUsCrosswalkTables();
  if (!tables) {
    throw new Error(
      'US crosswalk tables not loaded. Call loadCrosswalk("us", { tables }) first.'
    );
  }
  return tables;
}

export function crosswalkTableNameFromStem(stem: string): UsCrosswalkTableName {
  switch (stem) {
    case 'h3-to-dma':
      return 'h3ToDma';
    case 'h3-r5-to-zips':
      return 'h3R5ToZips';
    case 'zip-to-h3-r5':
      return 'zipToH3R5';
    case 'dma-to-zips':
      return 'dmaToZips';
    case 'dma-to-counties':
      return 'dmaToCounties';
    case 'county-to-dma':
      return 'countyToDma';
    case 'dma-region':
      throw new Error('dma-region is a CDN index stem, not a generated US crosswalk table');
    case 'zip-to-state':
      return 'zipToState';
    case 'place-to-dma':
      return 'placeToDma';
    default:
      throw new Error(`Unknown US crosswalk table stem: ${stem}`);
  }
}

export function listDmaSlugs(): string[] {
  const { dmaToZips } = requireUsCrosswalkTables();
  return Object.keys(dmaToZips)
    .map((slug) => asDmaSlugOrUndefined(slug))
    .filter((slug) => slug !== undefined)
    .sort();
}

export function isKnownDmaSlug(slug: string): boolean {
  const canonical = asDmaSlugOrUndefined(slug);
  if (!canonical) return false;
  return canonical in requireUsCrosswalkTables().dmaToZips;
}

/** Full zip→H3 r5 map for bulk shard builds (prefer {@link h3ForZip} for single lookups). */
export function zipToH3R5Table(): Record<string, string> {
  return { ...requireUsCrosswalkTables().zipToH3R5 };
}

export function fipsToDmaAssignments(): Map<string, CountyDmaAssignment> {
  const lookups = requireUsCrosswalkLookups();
  const countyToDma = requireUsCrosswalkTables().countyToDma;
  if (!countyToDma) {
    throw new Error('countyToDma not loaded — loadCrosswalk("us", { tables: ["countyToDma"] })');
  }

  const map = new Map<string, CountyDmaAssignment>();
  for (const fips of Object.keys(countyToDma)) {
    const key = String(fips).padStart(5, '0');
    const slug = canonicalDmaSlug(lookups.dmaSlugForCounty(key) ?? countyToDma[fips]);
    if (!slug) continue;
    map.set(key, {
      dmaSlug: slug,
      dmaName: slugToDmaDisplayName(slug),
    });
  }
  return map;
}

export function applyCountyDmaFromCrosswalk<
  T extends { fips: string; countyName: string; dmaSlug?: string; dmaName?: string },
>(properties: T, fipsToDma: ReadonlyMap<string, CountyDmaAssignment>): T {
  const assignment = fipsToDma.get(properties.fips);
  if (assignment) {
    return {
      ...properties,
      dmaSlug: assignment.dmaSlug,
      dmaName: assignment.dmaName,
    };
  }
  if (properties.dmaSlug?.trim()) {
    const slug = canonicalDmaSlug(properties.dmaSlug);
    return {
      ...properties,
      dmaSlug: slug,
      dmaName: properties.dmaName ?? slugToDmaDisplayName(slug),
    };
  }
  return properties;
}
