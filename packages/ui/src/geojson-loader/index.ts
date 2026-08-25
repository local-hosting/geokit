export type {
  GeoJsonLoadRequest,
  GeoJsonLoader,
  GeoJsonLoaderContext,
  GeoJsonLoaderResult,
  ViewportContext,
} from '@geokit/core/types/geojson-loader';
export { bindDebouncedMapMoveend, bindIncrementalViewportSync } from './viewport-sync.js';
export { featuresMapToCollection, mergeFeaturesById } from './merge.js';
export {
  clearLayerDatasetMounts,
  registerLayerDatasetMount,
  resolveLayerDatasetMount,
  unregisterLayerDatasetMount,
  type LayerDatasetMountFn,
} from './registry.js';
export {
  h3CellIdsForViewportLoad,
  loadFeatureCollectionShardsForH3Cells,
  normalizeLoadedCellId,
  type ViewportH3LoadOptions,
} from './shard-loader.js';
