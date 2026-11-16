/**
 * Shared point layer utilities — feature caching, paint expressions, sync helpers.
 *
 * Import from `geokit/ui/shared-points` (keeps layer-styles lazy-loaded).
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
  convert,
  crosswalk,
  ensureUsCrosswalkLoaded,
  isUsCrosswalkLoaded,
  GKPoint,
  GKZip,
  GKH3,
  GKDMA,
  GeoKind,
} from '@doppler-group/geokit/crosswalk';

export {
  POINT_DMA_PROPERTY,
  POINT_DMA_REGION_PROPERTY,
  type EnrichPointWithDmaOptions,
} from './utils/shared-points/point-dma';

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
  SHARED_POINT_DEFAULT_GLOW_OPACITY,
  SHARED_POINT_DEFAULT_GLOW_BLUR,
  SHARED_POINT_GLOW_BLUR,
  SHARED_POINT_GLOW_HIT_AREA_SCALE,
  SHARED_POINT_DEFAULT_GLOW_HOVER_OPACITY,
  SHARED_POINT_SECONDARY_RADIUS_SCALE,
  SHARED_POINT_RADIUS_EXPRESSION,
  SHARED_POINT_HOVER_GLOW_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_FILL,
  SHARED_POINT_FLOATING_BADGE_COLORED_RING_WIDTH,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_WIDTH,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_COLOR,
  SHARED_POINT_FLOATING_BADGE_SHADOW_COLOR,
  SHARED_POINT_FLOATING_BADGE_SHADOW_OPACITY,
  SHARED_POINT_FLOATING_BADGE_SHADOW_BLUR,
  SHARED_POINT_FLOATING_BADGE_SHADOW_RADIUS_PAD,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_ALIGNMENT,
  SHARED_POINT_FLOATING_BADGE_SHADOW_PITCH_SCALE,
  SHARED_POINT_FLOATING_BADGE_SELECTION_SHADOW_COLOR,
  SHARED_POINT_FLOATING_BADGE_SELECTION_RING_COLOR,
  SHARED_POINT_FLOATING_BADGE_SELECTED_RADIUS_SCALE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SELECT_ANIMATION_MS,
  SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS,
  SHARED_POINT_FLOATING_BADGE_RING_STROKE_WIDTH,
  resolveSharedPointFloatingBadgeTokens,
  lightenHexTowardWhite,
  darkenHexTowardBlack,
  mixHexColors,
  sharedPointFloatingBadgeHoverRingColorAt,
  sharedPointFloatingBadgeSoftColor,
  sharedPointFloatingBadgeSelectedColor,
  resolveFloatingBadgeSelectionAccentColor,
  SHARED_POINT_FLOATING_BADGE_SELECTED_COLOR_PROPERTY,
  SHARED_POINT_FLOATING_BADGE_SELECTED_DARKEN,
  annotatePointFeaturesFloatingBadgeHover,
  SHARED_POINT_FLOATING_BADGE_SOFT_LIGHTEN,
  SHARED_POINT_FLOATING_BADGE_SOFT_COLOR_PROPERTY,
  SHARED_POINT_FLOATING_BADGE_PAINT_REVISION,
  SHARED_POINT_FLOATING_BADGE_GLASS_OPACITY,
  SHARED_POINT_FLOATING_BADGE_GLASS_BLUR,
  SHARED_POINT_FLOATING_BADGE_GLASS_PAD,
  SHARED_POINT_FLOATING_BADGE_STROKE_OPACITY,
  SHARED_POINT_FLOATING_BADGE_OUTER_STROKE_OPACITY,
  sharedPointGlassLayerId,
  sharedPointFloatingBadgeGlassRadiusExpression,
  sharedPointFloatingBadgeGlassPadExpression,
  sharedPointFloatingBadgeRingWidthExpression,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFeatureStateSelectedCase,
  sharedPointExcludeFeatureIdFilter,
  syncSharedPointSelectedLayerFilter,
  sharedPointFloatingBadgeSelectedRadiusExpression,
  sharedPointFloatingBadgeSelectionTranslateAt,
  paintColorFromProperty,
  sharedPointRadiusByPropertyExpression,
  sharedPointColorExpression,
  circleSortKeyByProperty,
  sharedPointStrokeWidthExpression,
  sharedPointStrokeColorExpression,
  SHARED_POINT_STROKE_FROM_FILL_WIDTH,
  sharedPointStrokeFromFillWidthExpression,
  sharedPointStrokeFromFillColorExpression,
  annotatePointFeaturesStrokeFromFill,
  sharedPointOuterStrokeLayerId,
  literalNumberFromPaintExpression,
  sharedPointRadiusPlusStrokeWidth,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeRadius,
  sharedPointOffsetRadiusExpression,
  sharedPointFloatingBadgeShadowRadiusExpression,
  sharedPointFloatingBadgePaintExpressions,
  SHARED_POINT_FLOATING_BADGE_HOVER_LIGHTEN,
  SHARED_POINT_FLOATING_BADGE_HOVER_OUTER_STROKE_WIDTH,
  SHARED_POINT_FLOATING_BADGE_HOVER_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_HOVER_SHADOW_SCALE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_SCALE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_SHADOW_OPACITY,
  sharedPointGlowRadiusFromPointExpression,
  applySharedPointLayerPaint,
  attachSharedPointHoverGlowRadiusSync,
  buildSharedPointFeatureStateHoverPaint,
  type SharedPointLayerIds,
  type ApplySharedPointPaintOptions,
  type SharedPointFeatureStateHoverOptions,
  type SharedPointFeatureStateHoverPaint,
  type AnnotatePointStrokeFromFillOptions,
  type AnnotateFloatingBadgeHoverOptions,
  type SharedPointFillColorTransform,
  type SharedPointFloatingBadgePaintOptions,
  type SharedPointFloatingBadgeTokens,
} from './utils/shared-point-paint';

export {
  removeMapSourcesWithPrefix,
  getSharedPointRelatedLayerIds,
  getSharedPointRelatedSourceIds,
  tearDownSharedPointLayers,
  isMapTilerPointHelperAvailable,
  isSharedPointLayerSetComplete,
  waitForSharedPointLayerSetComplete,
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
  COMPACT_EMBED_GLOW_BLUR,
  COMPACT_EMBED_ZOOM_GROWTH_THRESHOLD,
  COMPACT_SIDEBAR_REFERENCE_HEIGHT_PX,
  embedPointScaleFromHeight,
  resolveEmbedPointScale,
  scaleSharedPointPaintForEmbed,
  type EmbedPointScaleFromHeightOptions,
  type ResolveEmbedPointScaleOptions,
  type SharedPointEmbedLayerOptions,
} from './utils/embed-point-scale';

export {
  createSharedPointLayerController,
  type SharedPointLayerController,
  type SharedPointLayerControllerOptions,
  type SharedPointGkMap,
  type SharedPointLayerMap,
} from './utils/shared-point-layer-controller';

export {
  ensureSharedPointLayerSetHealed,
  isSharedPointLayerSetFullyComplete,
  resolveSharedPointLayerIdForSource,
  syncSharedPointGlowPaint,
  syncSharedPointSelectionRingPaint,
  type EnsureSharedPointLayerSetHealedOptions,
} from './utils/shared-point-heal';
export {
  createSharedPointMapOrchestrator,
  type SharedPointMapOrchestrator,
  type SharedPointMapOrchestratorOptions,
} from './utils/shared-point-map-orchestrator';

export { bindGkVenueLayerStacking, restackVenueLayersForMarket } from './utils/venue-layer-stack-bind';

export {
  badgePreset,
  createBadgeMarker,
  syncBadgeChrome,
  sharedPointBadgeShapeFromProperties,
  sharedPointBadgeVariantFromProperties,
  type BadgeKind,
  type SyncBadgeChromeOptions,
} from './utils/markers/badge';

export {
  applyFloatingBadgeSelectionChrome,
  buildFloatingBadgeRoundedChromeOptions,
  buildFloatingBadgeSelectedChromeSpec,
  ensureFloatingBadgeSelectionChrome,
  floatingBadgeBodyShapeFromProperties,
  reapplyFloatingBadgeSelectionChromeIfActive,
  type FloatingBadgeSelectedChromeSpec,
} from './utils/markers/marker-selection-chrome';

export {
  SHARED_POINT_BADGE_ICON_PROPERTY,
  ensureSharedPointBadgeIconLayers,
  raiseSharedPointBadgeIconLayersOnTop,
  registerBadgeIconImage,
  sharedPointPointBadgeIconLayerId,
  sharedPointSelectionBadgeIconLayerId,
  syncBadgeIconTranslate,
  syncSelectionBadgeIconTranslate,
  healSharedPointBadgeIconTranslate,
} from './utils/paint/shared-point-badge-icon';

export { createMarker, createMarkerFactory } from './utils/markers/factory';
export type {
  Marker,
  MarkerFactory,
  MarkerPhase,
  MarkerPreset,
  MarkerState,
  MarkerFactoryAspects,
  MarkerInteractionPhase,
  MarkerInteractionState,
} from './utils/markers/factory';

export {
  MARKER_BODY_SHAPES,
  SHARED_POINT_MARKER_SHAPE_PROPERTY,
  markerBodyShapeFromProperties,
  type MarkerBodyShape,
} from './utils/markers/marker-shape';

export {
  GK_ROUNDED_RECT_MARKER_IMAGE_ID,
  ensureSharedPointRoundedBodyLayers,
  ensureSharedPointRoundedRectChromeLayers,
  ensureSharedPointSelectionRoundedRectChromeLayers,
  registerRoundedRectMarkerImage,
  sharedPointRoundedBodyLayerId,
  sharedPointRoundedOuterLayerId,
  sharedPointRoundedRingLayerId,
  sharedPointSelectionRoundedRingLayerId,
  sharedPointSelectionRoundedBodyLayerId,
  sharedPointSelectionRoundedOuterLayerId,
} from './utils/paint/shared-point-rounded-body';
export {
  applyFloatingBadgeMarkerStackPaint,
  buildFloatingBadgeStack,
  ensureFloatingBadgeMarkerStack,
  floatingBadgeRoundedRestingLayerIds,
  syncFloatingBadgeStackFilters,
  syncFloatingBadgeStackShapeFilters,
  type FloatingBadgeStack,
} from './utils/markers/marker-stack';
