import type { UsCrosswalkTables } from '../types';

const EMPTY_STRING_MAP: Readonly<Record<string, string>> = {};
const EMPTY_STRING_ARRAY_MAP: Readonly<Record<string, readonly string[]>> = {};

export function createEmptyUsCrosswalkTables(): UsCrosswalkTables {
  return {
    h3ToDma: EMPTY_STRING_MAP,
    h3R5ToZips: EMPTY_STRING_ARRAY_MAP,
    zipToH3R5: EMPTY_STRING_MAP,
    geohashToDma: EMPTY_STRING_MAP,
    geohashP8ToZips: EMPTY_STRING_ARRAY_MAP,
    zipToGeohashP8: EMPTY_STRING_MAP,
    dmaToZips: EMPTY_STRING_ARRAY_MAP,
  };
}

export function mergeUsCrosswalkTablePatch(
  base: UsCrosswalkTables,
  patch: Partial<UsCrosswalkTables>
): UsCrosswalkTables {
  return {
    h3ToDma: patch.h3ToDma ?? base.h3ToDma,
    h3R5ToZips: patch.h3R5ToZips ?? base.h3R5ToZips,
    zipToH3R5: patch.zipToH3R5 ?? base.zipToH3R5,
    geohashToDma: patch.geohashToDma ?? base.geohashToDma,
    geohashP8ToZips: patch.geohashP8ToZips ?? base.geohashP8ToZips,
    zipToGeohashP8: patch.zipToGeohashP8 ?? base.zipToGeohashP8,
    dmaToZips: patch.dmaToZips ?? base.dmaToZips,
    dmaToCounties: patch.dmaToCounties ?? base.dmaToCounties,
    countyToDma: patch.countyToDma ?? base.countyToDma,
    zipToState: patch.zipToState ?? base.zipToState,
    placeToDma: patch.placeToDma ?? base.placeToDma,
    tractToH3R1: patch.tractToH3R1 ?? base.tractToH3R1,
    h3R1ToTracts: patch.h3R1ToTracts ?? base.h3R1ToTracts,
  };
}
