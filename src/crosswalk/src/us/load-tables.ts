import type { UsCrosswalkTables, CrosswalkSpine } from '../types';
import { createUsTableLookups } from './tables';
import { createEmptyUsCrosswalkTables, mergeUsCrosswalkTablePatch } from './empty-tables';
import {
  getUsCrosswalkTables,
  isCrosswalkTableLoaded,
  setUsCrosswalkRegistry,
} from '../load/registry';
import type { UsCrosswalkTableName } from './table-names';

type TableLoader = () => Promise<Partial<UsCrosswalkTables>>;

const TABLE_LOADERS: Record<UsCrosswalkTableName, TableLoader> = {
  h3ToDma: async () => {
    const { H3_TO_DMA } = await import('../../generated/us/h3-to-dma');
    return { h3ToDma: H3_TO_DMA };
  },
  h3R5ToZips: async () => {
    const { H3_R5_TO_ZIPS } = await import('../../generated/us/h3-r5-to-zips');
    return { h3R5ToZips: H3_R5_TO_ZIPS };
  },
  zipToH3R5: async () => {
    const { ZIP_TO_H3_R5 } = await import('../../generated/us/zip-to-h3-r5');
    return { zipToH3R5: ZIP_TO_H3_R5 };
  },
  geohashToDma: async () => {
    const { GEOHASH_TO_DMA } = await import('../../generated/us/geohash-to-dma');
    return { geohashToDma: GEOHASH_TO_DMA };
  },
  geohashP8ToZips: async () => {
    const { GEOHASH_P8_TO_ZIPS } = await import('../../generated/us/geohash-p8-to-zips');
    return { geohashP8ToZips: GEOHASH_P8_TO_ZIPS };
  },
  zipToGeohashP8: async () => {
    const { ZIP_TO_GEOHASH_P8 } = await import('../../generated/us/zip-to-geohash-p8');
    return { zipToGeohashP8: ZIP_TO_GEOHASH_P8 };
  },
  dmaToZips: async () => {
    const { DMA_TO_ZIPS } = await import('../../generated/us/dma-to-zips');
    return { dmaToZips: DMA_TO_ZIPS };
  },
  dmaToCounties: async () => {
    const { DMA_TO_COUNTIES } = await import('../../generated/us/dma-to-counties');
    return { dmaToCounties: DMA_TO_COUNTIES };
  },
  countyToDma: async () => {
    const { COUNTY_TO_DMA } = await import('../../generated/us/county-to-dma');
    return { countyToDma: COUNTY_TO_DMA };
  },
  dmaRegion: async () => {
    const { DMA_REGION } = await import('../../generated/us/dma-region');
    return { dmaRegion: DMA_REGION };
  },
  zipToState: async () => {
    const { ZIP_TO_STATE } = await import('../../generated/us/zip-to-state');
    return { zipToState: ZIP_TO_STATE };
  },
  placeToDma: async () => {
    const { PLACE_TO_DMA } = await import('../../generated/us/place-to-dma');
    return { placeToDma: PLACE_TO_DMA };
  },
};

export async function loadUsCrosswalkTableNames(
  names: readonly UsCrosswalkTableName[],
  spine?: CrosswalkSpine
): Promise<void> {
  const pending = names.filter((name) => !isCrosswalkTableLoaded(name));
  if (pending.length === 0) return;

  const patches = await Promise.all(pending.map((name) => TABLE_LOADERS[name]()));
  let tables = getUsCrosswalkTables() ?? createEmptyUsCrosswalkTables();
  for (const patch of patches) {
    tables = mergeUsCrosswalkTablePatch(tables, patch);
  }

  const lookups = createUsTableLookups(tables);
  setUsCrosswalkRegistry(tables, lookups, pending, spine);
}
