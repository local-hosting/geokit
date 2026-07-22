/**
 * Shared point layer utilities — feature caching, paint expressions, sync helpers.
 *
 * Import from `@twinfile/geokit/ui/shared-points` (keeps layer-styles lazy-loaded).
 */

export {
  generateGeodesicCirclePolygon,
  ensureGeodesicRadiusRingLayers,
  updateGeodesicRadiusRingData,
  getGeodesicRadiusRingLayerIds,
  type GeodesicRadiusRingSpec,
  type GeodesicRadiusRingLayerIds,
} from './utils/geodesic-circle';

export {
  CachedPointFeatureBuilder,
  normalizePointCoordinates,
  type CachedPointFeature,
  type PointGeometry,
  type BuildCachedPointFeaturesOptions,
  type CachedPointFeatureBuilderOptions,
} from './utils/shared-point-features';

export {
  SHARED_POINT_MIN_RADIUS_PX,
  SHARED_POINT_UNIFORM_GLOW_OPACITY,
  SHARED_POINT_GLOW_BLUR,
  SHARED_POINT_GLOW_HIT_AREA_SCALE,
  SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  SHARED_POINT_SECONDARY_RADIUS_SCALE,
  SHARED_POINT_RADIUS_EXPRESSION,
  SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION,
  paintColorFromProperty,
  sharedPointRadiusByPropertyExpression,
  sharedPointColorExpression,
  circleSortKeyByProperty,
  sharedPointStrokeWidthExpression,
  sharedPointStrokeColorExpression,
  applySharedPointLayerPaint,
  attachSharedPointHoverGlowRadiusSync,
  buildSharedPointFeatureStateHoverPaint,
  type SharedPointLayerIds,
  type ApplySharedPointPaintOptions,
  type SharedPointFeatureStateHoverOptions,
  type SharedPointFeatureStateHoverPaint,
} from './utils/shared-point-paint';

export {
  removeMapSourcesWithPrefix,
  getSharedPointRelatedLayerIds,
  getSharedPointRelatedSourceIds,
  tearDownSharedPointLayers,
  isMapTilerPointHelperAvailable,
  ensureSharedPointGeoJsonSource,
  updateSharedPointSourceData,
  createSharedPointLayerSet,
  createSharedPointLayersFromPaint,
  preloadSharedPointLayerStyles,
  syncExistingSharedPointLayers,
  type RemoveMapSourcesOptions,
  type UpdateSharedPointSourceOptions,
  type CreateSharedPointLayerSetOptions,
  type CreateSharedPointLayersFromPaintOptions,
  type SyncExistingSharedPointLayersOptions,
} from './utils/shared-point-sync';

export {
  DEFAULT_EMBED_MIN_SCALE,
  DEFAULT_EMBED_REFERENCE_HEIGHT_PX,
  applyEmbedScaleToSharedPointLayerOptions,
  COMPACT_EMBED_MIN_RADIUS_PX,
  embedPointScaleFromHeight,
  resolveEmbedPointScale,
  scaleSharedPointPaintForEmbed,
  type EmbedPointScaleFromHeightOptions,
  type ResolveEmbedPointScaleOptions,
  type SharedPointEmbedLayerOptions,
} from './utils/embed-point-scale';
