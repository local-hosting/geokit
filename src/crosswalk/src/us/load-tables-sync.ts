import {
  COUNTY_TO_DMA,
  DMA_TO_COUNTIES,
  DMA_TO_ZIPS,
  GEOHASH_P8_TO_ZIPS,
  GEOHASH_TO_DMA,
  H3_R5_TO_ZIPS,
  H3_TO_DMA,
  PLACE_TO_DMA,
  ZIP_TO_GEOHASH_P8,
  ZIP_TO_H3_R5,
  ZIP_TO_STATE,
} from '../../generated/us/index.js';
import { US_CROSSWALK_TABLE_NAMES } from './table-names';
import { createUsTableLookups } from './tables';
import { setUsCrosswalkRegistry } from '../load/registry';
import type { CrosswalkSpine } from '../types';

/** Test / sync path — loads every US table via static imports. */
export function loadAllUsCrosswalkTablesSync(spine: CrosswalkSpine = 'h3'): void {
  const tables = {
    h3ToDma: H3_TO_DMA,
    h3R5ToZips: H3_R5_TO_ZIPS,
    zipToH3R5: ZIP_TO_H3_R5,
    geohashToDma: GEOHASH_TO_DMA,
    geohashP8ToZips: GEOHASH_P8_TO_ZIPS,
    zipToGeohashP8: ZIP_TO_GEOHASH_P8,
    dmaToZips: DMA_TO_ZIPS,
    dmaToCounties: DMA_TO_COUNTIES,
    countyToDma: COUNTY_TO_DMA,
    zipToState: ZIP_TO_STATE,
    placeToDma: PLACE_TO_DMA,
  };
  const lookups = createUsTableLookups(tables);
  setUsCrosswalkRegistry(tables, lookups, US_CROSSWALK_TABLE_NAMES, spine);
}
