/**
 * H3 Hexagonal Indexing utilities
 * Convert coordinates to H3 cells, work with cell hierarchies, boundaries, and neighbors
 */

// Core conversion functions
export {
  coordinatesToH3,
  h3ToCoordinates,
  h3GetResolution,
  validateH3,
  snapToH3Cell,
} from './core';

// Boundary operations
export { h3ToBoundary, h3ToPolygon } from './boundary';
export { unwrapPolygonRingLongitudes } from './unwrap-ring-longitudes.js';

// Hierarchy operations
export { h3ToParent, h3ToChildren } from './hierarchy';

// Neighbor operations
export { h3Neighbors, h3AreNeighbors } from './neighbors';

// Polygon operations
export { h3SetToMultiPolygon, polygonToH3 } from './polygon';

// Cell map ↔ polygon spatial join
export {
  joinCellMapToPolygon,
  lookupValuesForH3Cells,
  polygonGeometryToH3Cells,
  type H3CellValueMap,
  type JoinCellMapToPolygonOptions,
  type PolygonToH3CellsOptions,
} from './cell-polygon-join';

// Cell map spreadsheet ops (invert, rollup, parent resolve)
export {
  invertCellMap,
  rollupCellMap,
  keyToParentCell,
  invertH3ToZips,
  rollupH3ToZips,
  zipToH3ParentCell,
  type H3CellMultiMap,
  type H3ToZips,
  type InvertCellMapOptions,
} from './cell-crosswalk';

// Metrics
export { h3EdgeLength, h3CellArea } from './metrics';

// Type-safe functions with branded types
export {
  coordinatesToH3Point,
  coordinatesToH3Area,
  h3PointToCoordinates,
  h3AreaToCoordinates,
  h3PointToBoundary,
  h3AreaToBoundary,
  h3PointToPolygon,
  h3AreaToPolygon,
  h3PointNeighbors,
  h3AreaNeighbors,
} from './type-safe';

export { compactH3CellId, expandH3CellId } from './cell-id';
export { normalizeH3CellToResolution } from './cell-id-resolution.js';

export {
  h3ResolutionFromZoom,
  H3_RESOLUTION_FROM_ZOOM_MIN,
  H3_RESOLUTION_FROM_ZOOM_MAX,
  H3_RESOLUTION_FROM_ZOOM_FACTOR,
  type H3ResolutionFromZoomOptions,
} from './resolution-from-zoom';

export { h3DiskToFeatureCollection, type H3DiskToFeatureCollectionOptions } from './disk-features';

export * from './cell-fade';
export * from './cursor-dwell';
export * from './viewport';
export * from './session-loaded';
export * from './map-viewport';

export {
  h3CellToPolygonFeature,
  h3CellsForViewport,
  filterCellsInCoverage,
  viewportCoverageCells,
  h3CoveragePolygonCollection,
  DEFAULT_MAX_H3_HEX_POLYGONS,
  DEFAULT_MAX_VIEWPORT_H3_EVAL,
  type H3CellPolygonOptions,
} from './viewport-coverage';

export {
  normalizeRegionSlug,
  canonicalRegionH3CellId,
  buildCellToRegionMap,
  buildRegionMarketCellsIndex,
  collectCellIdsForRegionSlugs,
  resolveRegionSlugsForViewportCells,
  buildRegionCellFeatureCollection,
  mergeRegionCellFeatures,
  type RegionMarketCellsIndex,
  type RegionCellFeatureOptions,
} from './cell-to-region-index.js';
