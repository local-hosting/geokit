import {
  COUNTY_TO_DMA,
  DMA_REGION,
  DMA_TO_COUNTIES,
  DMA_TO_ZIPS,
  H3_R5_TO_ZIPS,
  H3_TO_DMA,
  PLACE_TO_DMA,
  ZIP_TO_H3_R5,
  ZIP_TO_STATE,
} from '../../generated/us/index.ts';
import { US_CROSSWALK_TABLE_NAMES } from './table-names.js';
import { createUsTableLookups } from './tables.js';
import { setUsCrosswalkRegistry } from '../registry.js';

/** Test / sync path — loads every US table via static imports. */
export function loadAllUsCrosswalkTablesSync(): void {
  const tables = {
    h3ToDma: H3_TO_DMA,
    h3R5ToZips: H3_R5_TO_ZIPS,
    zipToH3R5: ZIP_TO_H3_R5,
    dmaToZips: DMA_TO_ZIPS,
    dmaToCounties: DMA_TO_COUNTIES,
    countyToDma: COUNTY_TO_DMA,
    dmaRegion: DMA_REGION,
    zipToState: ZIP_TO_STATE,
    placeToDma: PLACE_TO_DMA,
  };
  const lookups = createUsTableLookups(tables);
  setUsCrosswalkRegistry(tables, lookups, US_CROSSWALK_TABLE_NAMES);
}
