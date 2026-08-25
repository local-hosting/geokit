import type { UsCrosswalkTables } from '../types.js';
import { createUsTableLookups } from './tables.js';
import { createEmptyUsCrosswalkTables, mergeUsCrosswalkTablePatch } from './empty-tables.js';
import {
  getUsCrosswalkTables,
  isCrosswalkTableLoaded,
  setUsCrosswalkRegistry,
} from '../load/registry.js';
import type { UsCrosswalkTableName } from './table-names.js';

type TableLoader = () => Promise<Partial<UsCrosswalkTables>>;

const TABLE_LOADERS: Record<UsCrosswalkTableName, TableLoader> = {
  h3ToDma: async () => {
    const { H3_TO_DMA } = await import('../../generated/us/h3-to-dma.js');
    return { h3ToDma: H3_TO_DMA };
  },
  h3R5ToZips: async () => {
    const { H3_R5_TO_ZIPS } = await import('../../generated/us/h3-r5-to-zips.js');
    return { h3R5ToZips: H3_R5_TO_ZIPS };
  },
  zipToH3R5: async () => {
    const { ZIP_TO_H3_R5 } = await import('../../generated/us/zip-to-h3-r5.js');
    return { zipToH3R5: ZIP_TO_H3_R5 };
  },
  dmaToZips: async () => {
    const { DMA_TO_ZIPS } = await import('../../generated/us/dma-to-zips.js');
    return { dmaToZips: DMA_TO_ZIPS };
  },
  dmaToCounties: async () => {
    const { DMA_TO_COUNTIES } = await import('../../generated/us/dma-to-counties.js');
    return { dmaToCounties: DMA_TO_COUNTIES };
  },
  countyToDma: async () => {
    const { COUNTY_TO_DMA } = await import('../../generated/us/county-to-dma.js');
    return { countyToDma: COUNTY_TO_DMA };
  },
  dmaRegion: async () => {
    const { DMA_REGION } = await import('../../generated/us/dma-region.js');
    return { dmaRegion: DMA_REGION };
  },
  zipToState: async () => {
    const { ZIP_TO_STATE } = await import('../../generated/us/zip-to-state.js');
    return { zipToState: ZIP_TO_STATE };
  },
  placeToDma: async () => {
    const { PLACE_TO_DMA } = await import('../../generated/us/place-to-dma.js');
    return { placeToDma: PLACE_TO_DMA };
  },
};

export async function loadUsCrosswalkTableNames(
  names: readonly UsCrosswalkTableName[]
): Promise<void> {
  const pending = names.filter((name) => !isCrosswalkTableLoaded(name));
  if (pending.length === 0) return;

  const patches = await Promise.all(pending.map((name) => TABLE_LOADERS[name]()));
  let tables = getUsCrosswalkTables() ?? createEmptyUsCrosswalkTables();
  for (const patch of patches) {
    tables = mergeUsCrosswalkTablePatch(tables, patch);
  }

  const lookups = createUsTableLookups(tables);
  setUsCrosswalkRegistry(tables, lookups, pending);
}
