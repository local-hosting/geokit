export type {
  CatalogIdentity,
  CountyFips,
  DmaSlug,
  GeoIdentity,
  GeoPoint,
  ConvertOutput,
  GeoRef,
  GeoRefInput,
  MacroRegion,
  PlaceKey,
  StateCode,
  ZipCode,
} from '@geokit/core';

export {
  GKCountry,
  GKCounty,
  GKDMA,
  GKDMARecord,
  GKGeohash,
  GKH3,
  GKPlace,
  GKPlaceInState,
  GKPoint,
  GKZip,
  asDMA,
  asDmaSlug,
  asDmaSlugOrUndefined,
  asZipCode,
  parseGeoRef,
  GeoKind,
} from '@geokit/core';

export type {
  CrosswalkCountry,
  CrosswalkInput,
  CrosswalkResult,
  CrosswalkSpine,
  DMA,
  LatLon,
  LoadCrosswalkOptions,
  PlaceToDmaEntry,
  UsCrosswalkTableName,
  UsCrosswalkTables,
} from './types';

export { US_CROSSWALK_TABLE_NAMES, US_CROSSWALK_PRESETS } from './us/table-names';

export { loadCrosswalk, loadUsCrosswalk, loadUsCrosswalkSync, resetCrosswalkForTest } from './load/load';
export {
  convert,
  crosswalk,
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
  type CrosswalkOptions,
} from './lookup/convert';
export {
  GEOHASH_ZIP_INDEX_PRECISION,
  geohashCellIdForLookup,
  normalizeGeohashCellId,
  truncateGeohashCellId,
} from './geohash/cell-id';
export { compactH3CellId, expandH3CellId } from './h3/cell-id';
export { ensureH3Projection, isH3ProjectionLoaded } from './h3/project';
export {
  isCrosswalkCountryLoaded,
  isCrosswalkTableLoaded,
  getLoadedCrosswalkTableNames,
  getCrosswalkSpine,
  requireUsCrosswalkLookups,
  getUsCrosswalkTables,
} from './load/registry';

export {
  canonicalDmaSlug,
  ensureUsCrosswalkLoaded,
  isUsCrosswalkLoaded,
  setCountyBoundaryLoader,
  registerCountyBoundaries,
  isCountyBoundariesLoaded,
  clearCountyBoundaries,
  mergeDmaSlugList,
  type CountyBoundaryLoader,
} from './us/setup';

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
} from './h3/market-cells';
