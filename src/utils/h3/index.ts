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

// Hierarchy operations
export { h3ToParent, h3ToChildren } from './hierarchy';

// Neighbor operations
export { h3Neighbors, h3AreNeighbors } from './neighbors';

// Polygon operations
export { h3SetToMultiPolygon, polygonToH3 } from './polygon';

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

export * from './cell-fade';
export * from './viewport';
