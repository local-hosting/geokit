export type {
  CrosswalkCountry,
  CrosswalkInput,
  CrosswalkResult,
  CrosswalkSpine,
  GeoKind,
  LatLon,
  LoadCrosswalkOptions,
  PlaceToDmaEntry,
  UsCrosswalkTableName,
  UsCrosswalkTables,
} from './types.js';

export { US_CROSSWALK_TABLE_NAMES, US_CROSSWALK_PRESETS } from './us/table-names.js';

export { loadCrosswalk, loadUsCrosswalk, loadUsCrosswalkSync, resetCrosswalkForTest } from './load/load.js';
export {
  crosswalk,
  type CrosswalkOptions,
} from './lookup/crosswalk.js';
export {
  dmaForH3,
  dmaForGeohash,
  dmaForPoint,
  dmaForZip,
  decodeGeohash,
  geohashForLatLon,
  geohashForPoint,
  geohashForZip,
  geohashCellToLatLon,
  h3ForPoint,
  h3ForZip,
  pointForGeohash,
  pointForH3,
  pointForZip,
  zipsForGeohash,
  zipsForH3,
  zipsInDma,
  countiesInDma,
} from './lookup/convert.js';
export {
  GEOHASH_ZIP_INDEX_PRECISION,
  geohashCellIdForLookup,
  normalizeGeohashCellId,
  truncateGeohashCellId,
} from './geohash/cell-id.js';
export { compactH3CellId, expandH3CellId } from './h3/cell-id.js';
export { ensureH3Projection, isH3ProjectionLoaded } from './h3/project.js';
export {
  isCrosswalkCountryLoaded,
  isCrosswalkTableLoaded,
  getLoadedCrosswalkTableNames,
  getCrosswalkSpine,
  requireUsCrosswalkLookups,
  getUsCrosswalkTables,
} from './load/registry.js';

export {
  buildCellToDmaMap,
  buildH3ToDmaMap,
  buildDmaMarketCellsIndex,
  buildDmaCellFeatureCollection,
  mergeDmaCellFeatures,
  collectCellIdsForDmaSlugs,
  resolveDmaSlugsForViewportCells,
  buildCellToRegionMap,
  buildRegionMarketCellsIndex,
  buildRegionCellFeatureCollection,
  mergeRegionCellFeatures,
  collectCellIdsForRegionSlugs,
  resolveRegionSlugsForViewportCells,
  canonicalRegionH3CellId,
  normalizeRegionSlug,
  type DmaMarketCellsIndex,
  type RegionMarketCellsIndex,
  type RegionCellFeatureOptions,
} from './h3/market-cells.js';

