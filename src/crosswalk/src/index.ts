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
} from '@local-hosting/geokit/core';

export {
  normalizeTractGeoid,
  tractCountyFips,
  tractStateFips,
  stateAbbrForTract,
} from './us/tract-geoid.js';
export { STATE_FIPS_TO_ABBR, stateAbbrForTractFips } from './us/state-fips.js';
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
  GKTract,
  GKZip,
  asDMA,
  asDmaSlug,
  asDmaSlugOrUndefined,
  asZipCode,
  parseGeoRef,
} from '@local-hosting/geokit/core';

export { GeoKind } from './geo-kind.js';

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
  h3ForTract,
  tractsForH3,
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
  allZipCentroids,
  buildZipToStateMap,
  clearZipCentroidCache,
  filterZipsByPolygon,
  stateForH3Cell,
  statesForH3Cell,
  stateForTract,
  stateForPoint,
  stateForZip,
  usStateAbbrs,
  zipsInPolygon,
  type ZipCentroid,
  type ZipsInPolygonOptions,
} from './lookup/spatial';
export {
  GEOHASH_ZIP_INDEX_PRECISION,
  geohashCellIdForLookup,
  normalizeGeohashCellId,
  truncateGeohashCellId,
} from './geohash/cell-id';
export { compactH3CellId, expandH3CellId } from '@local-hosting/geokit/h3/lite';
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
  LEGACY_DMA_SLUG_ALIASES,
  resolveCanonicalDmaSlug,
  slugToDmaDisplayName,
  canonicalDmaSlug,
} from './us/dma-labels';

export {
  applyCountyDmaFromCrosswalk,
  crosswalkTableNameFromStem,
  fipsToDmaAssignments,
  isKnownDmaSlug,
  listDmaSlugs,
  requireUsCrosswalkTables,
  zipToH3R5Table,
  tractToH3R1Table,
  h3R1ToTractsTable,
  type CountyDmaAssignment,
} from './us/table-access';

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

export {
  H3_MIN_RESOLUTION,
  H3_MAX_RESOLUTION,
  PLATFORM_H3_HERO_RESOLUTION,
  PLATFORM_H3_RESOLUTION,
  H3_ZIP_INDEX_RESOLUTION,
  PLATFORM_H3_REFERENCE_RESOLUTION,
  PLATFORM_H3_CROSSWALK_TIERS,
  PLATFORM_H3_CROSSWALK_EXPORT_MAX,
  PLATFORM_H3_CROSSWALK_EXPORT_TIERS,
  VENUE_H3_RESOLUTION,
  PLACE_H3_RESOLUTION,
  GEOHASH_MIN_PRECISION,
  GEOHASH_MAX_PRECISION,
  PLATFORM_GEOHASH_PRECISION,
  PLATFORM_GEOHASH_CROSSWALK_TIERS,
  PLATFORM_GEOHASH_CROSSWALK_EXPORT_MAX,
  PLATFORM_GEOHASH_CROSSWALK_EXPORT_TIERS,
  type PlatformH3CrosswalkTier,
  type PlatformGeohashCrosswalkTier,
} from './platform-resolution.js';

export { buildGeohashNativeFromH3, type GeohashToZips, type H3ToZips } from './h3/geohash-native.js';

export {
  invertH3ToZips,
  rollupH3ToZips,
  rollupGeohashToZips,
  zipToH3ParentCell,
  resolveH3ToZipsAtResolution,
  resolveGeohashToZipsAtPrecision,
} from './h3/zip-crosswalk-resolve.js';
