import type { MapInstance } from '../../../providers/types';

export interface SharedPointLayerIds {
  sourceId: string;
  glowLayerId: string;
  pointLayerId: string;
}

/** Outer white (or custom) stroke drawn outside the colored ring. */
export function sharedPointOuterStrokeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-outer-stroke`;
}

export function sharedPointGlassLayerId(pointLayerId: string): string {
  return `${pointLayerId}-glass`;
}

export function sharedPointSelectionBadgeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge`;
}

export function sharedPointSelectionBadgeOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-badge-outer`;
}

/** Hide selection-source chrome (clear / idle). Select reveals it for settle. */
export function hideFloatingBadgeCircleSelectionLayers(
  map: MapInstance,
  pointLayerId: string,
): void {
  if (!map.setPaintProperty) return;
  for (const [layerId, prop, value] of [
    [sharedPointSelectionBadgeLayerId(pointLayerId), 'circle-opacity', 0],
    [sharedPointSelectionBadgeLayerId(pointLayerId), 'circle-stroke-opacity', 0],
    [sharedPointSelectionBadgeOuterLayerId(pointLayerId), 'circle-opacity', 0],
    [sharedPointSelectionBadgeOuterLayerId(pointLayerId), 'circle-stroke-opacity', 0],
    [`${pointLayerId}-selection-rounded-outer`, 'icon-opacity', 0],
    [`${pointLayerId}-selection-rounded-ring`, 'icon-opacity', 0],
    [`${pointLayerId}-selection-rounded-body`, 'icon-opacity', 0],
    [`${pointLayerId}-selection-badge-icon`, 'icon-opacity', 0],
  ] as const) {
    if (!map.getLayer?.(layerId)) continue;
    try {
      map.setPaintProperty(layerId, prop, value);
    } catch {
      /* style swap */
    }
  }
}

export function sharedPointHoverBadgeLayerId(pointLayerId: string): string {
  return `${pointLayerId}-hover-badge`;
}

export function sharedPointHoverBadgeOuterLayerId(pointLayerId: string): string {
  return `${pointLayerId}-hover-badge-outer`;
}

export function sharedPointSelectionRingLayerId(pointLayerId: string): string {
  return `${pointLayerId}-selection-ring`;
}

/**
 * Layers that should receive pointer events for floating-badge / shared points.
 * Omit the opacity-0 selection ring — empty ring hits steal click dedup from real badges.
 */
export function sharedPointHitLayerIds(pointLayerId: string, glowLayerId: string): string[] {
  return [
    glowLayerId,
    pointLayerId,
    sharedPointOuterStrokeLayerId(pointLayerId),
    sharedPointGlassLayerId(pointLayerId),
    sharedPointSelectionBadgeLayerId(pointLayerId),
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
    `${pointLayerId}-rounded-outer`,
    `${pointLayerId}-selection-rounded-outer`,
  ];
}

/** Mapbox Standard style slot for venue overlays above 3D buildings. */
export const MAPBOX_VENUE_OVERLAY_SLOT = 'top';

/** Matches `MAP_3D_BUILDINGS_LAYER_ID` in map-terrain-buildings (avoid circular import). */
const SHARED_POINT_3D_BUILDINGS_LAYER_ID = 'gk-3d-buildings';

/** True when draped terrain or geokit 3D buildings need marker depth heal. */
export function isSharedPoint3dSurfaceActive(map: MapInstance): boolean {
  const m = map as {
    getTerrain?: () => unknown;
    getLayer?: (id: string) => unknown;
  };
  return Boolean(m.getTerrain?.()) || Boolean(m.getLayer?.(SHARED_POINT_3D_BUILDINGS_LAYER_ID));
}

type MapWithStyleSlots = MapInstance & {
  setSlot?: (layerId: string, slot?: string | null) => void;
  setLayoutProperty?: (layerId: string, name: string, value: unknown) => void;
  moveLayer?: (layerId: string, beforeId?: string) => void;
};

function layerStyleSlot(
  map: MapWithStyleSlots,
  layerId: string
): string | null | undefined {
  const layer = map.getLayer?.(layerId) as { slot?: string | null } | null | undefined;
  if (!layer || typeof layer !== 'object') return undefined;
  return layer.slot ?? undefined;
}

function setVenueLayerSlotTop(map: MapWithStyleSlots, layerId: string): void {
  try {
    map.setSlot?.(layerId, MAPBOX_VENUE_OVERLAY_SLOT);
  } catch {
    /* non–Mapbox Standard styles */
  }
}

/**
 * Mapbox Standard forbids moveLayer across slots and console.errors before throwing.
 * Align both layers to the same slot (prefer existing / venue `top`) then move.
 */
export function moveSharedPointLayer(
  map: MapInstance,
  layerId: string,
  beforeId?: string
): void {
  const m = map as MapWithStyleSlots;
  if (!m.getLayer?.(layerId)) return;

  const usesSlots = typeof m.setSlot === 'function';
  const canMoveLayer = typeof m.moveLayer === 'function';

  if (beforeId && !m.getLayer?.(beforeId)) {
    if (usesSlots) {
      setVenueLayerSlotTop(m, layerId);
    } else if (canMoveLayer) {
      try {
        m.moveLayer(layerId);
      } catch {
        /* style swap */
      }
    }
    return;
  }

  if (beforeId && usesSlots) {
    const beforeSlot = layerStyleSlot(m, beforeId);
    const layerSlot = layerStyleSlot(m, layerId);
    if (beforeSlot !== layerSlot) {
      const target = beforeSlot ?? layerSlot ?? MAPBOX_VENUE_OVERLAY_SLOT;
      try {
        if (layerSlot !== target) m.setSlot!(layerId, target);
        if (beforeSlot !== target) m.setSlot!(beforeId, target);
      } catch {
        /* non–Mapbox Standard styles */
      }
    }
  }

  // Mapbox Standard: bare moveLayer(id) crosses style slots and errors.
  if (beforeId === undefined && usesSlots) {
    setVenueLayerSlotTop(m, layerId);
    return;
  }

  if (!canMoveLayer) return;

  try {
    if (beforeId !== undefined) m.moveLayer(layerId, beforeId);
    else m.moveLayer(layerId);
  } catch {
    /* style swap / concurrent mutation */
  }
}

/** Circle / symbol / line paint so GeoJSON overlays stay visible over terrain mesh. */
export function healOverlayLayerAbove3dTerrain(
  map: MapWithStyleSlots,
  layerId: string,
  layerType: string,
): void {
  if (layerType === 'circle') {
    healCircleLayerAbove3dExtrusions(map, layerId);
    return;
  }
  if (layerType === 'symbol') {
    healSymbolLayerAbove3dExtrusions(map, layerId);
    return;
  }
  if (layerType !== 'line' || !map.setPaintProperty) return;
  try {
    map.setPaintProperty(layerId, 'line-occlusion-opacity', 0);
    setVenueLayerSlotTop(map, layerId);
  } catch {
    /* mixed layer types */
  }
}

function healCircleLayerAbove3dExtrusions(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId) || !map.setPaintProperty) return;
  try {
    map.setPaintProperty(layerId, 'circle-pitch-alignment', 'viewport');
    map.setPaintProperty(layerId, 'circle-pitch-scale', 'viewport');
    map.setPaintProperty(layerId, 'circle-emissive-strength', 1);
    map.setPaintProperty(layerId, 'circle-occlusion-opacity', 0);
    setVenueLayerSlotTop(map, layerId);
  } catch {
    /* mixed layer types */
  }
}

function healSymbolLayerAbove3dExtrusions(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId)) return;
  try {
    map.setLayoutProperty?.(layerId, 'symbol-z-elevate', true);
    map.setPaintProperty?.(layerId, 'icon-occlusion-opacity', 0);
    setVenueLayerSlotTop(map, layerId);
  } catch {
    /* not a symbol layer */
  }
}

function healGroundShadowCircleAbove3dTerrain(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId) || !map.setPaintProperty) return;
  try {
    map.setPaintProperty(layerId, 'circle-occlusion-opacity', 0);
  } catch {
    /* mixed layer types */
  }
}

function revertGroundShadowCircleFrom3dExtrusions(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId) || !map.setPaintProperty) return;
  try {
    map.setPaintProperty(layerId, 'circle-occlusion-opacity', 1);
  } catch {
    /* mixed layer types */
  }
}

function revertBadgeCircleFrom3dExtrusions(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId) || !map.setPaintProperty) return;
  try {
    map.setPaintProperty(layerId, 'circle-emissive-strength', 0);
    map.setPaintProperty(layerId, 'circle-occlusion-opacity', 1);
    map.setSlot?.(layerId, null);
  } catch {
    /* mixed layer types */
  }
}

function revertSymbolLayerFrom3dExtrusions(map: MapWithStyleSlots, layerId: string): void {
  if (!map.getLayer?.(layerId)) return;
  try {
    map.setLayoutProperty?.(layerId, 'symbol-z-elevate', false);
    map.setPaintProperty?.(layerId, 'icon-occlusion-opacity', 1);
    map.setSlot?.(layerId, undefined);
  } catch {
    /* not a symbol layer */
  }
}

/** Ground shadow discs — stay in the basemap slot; only depth occlusion changes on 3D terrain. */
function sharedPointGroundShadowCircleLayerIds(
  pointLayerId: string,
  glowLayerId: string,
): readonly string[] {
  return [glowLayerId, `${glowLayerId}-hover`, `${pointLayerId}-selection-shadow`];
}

/** Floating badge circle stack — viewport translate + top slot when draped on terrain. */
function sharedPointBadgeCircleLayerIds(pointLayerId: string): readonly string[] {
  return [
    pointLayerId,
    sharedPointOuterStrokeLayerId(pointLayerId),
    sharedPointGlassLayerId(pointLayerId),
    sharedPointHoverBadgeLayerId(pointLayerId),
    sharedPointHoverBadgeOuterLayerId(pointLayerId),
    sharedPointSelectionBadgeLayerId(pointLayerId),
    sharedPointSelectionBadgeOuterLayerId(pointLayerId),
    sharedPointSelectionRingLayerId(pointLayerId),
  ];
}

function sharedPointVenueSymbolLayerIds(pointLayerId: string): readonly string[] {
  return [
    `${pointLayerId}-badge-icon`,
    `${pointLayerId}-selection-badge-icon`,
    `${pointLayerId}-rounded-outer`,
    `${pointLayerId}-rounded-ring`,
    `${pointLayerId}-rounded-body`,
    `${pointLayerId}-selection-rounded-outer`,
    `${pointLayerId}-selection-rounded-ring`,
    `${pointLayerId}-selection-rounded-body`,
  ];
}

/** Venue markers above Corio / Mapbox Standard 3D buildings and `gk-3d-buildings`. */
export function applySharedPointLayersAbove3dExtrusions(
  map: MapInstance,
  ids: Pick<SharedPointLayerIds, 'glowLayerId' | 'pointLayerId'>,
): void {
  const mapSlot = map as MapWithStyleSlots;
  const { pointLayerId, glowLayerId } = ids;
  for (const layerId of sharedPointGroundShadowCircleLayerIds(pointLayerId, glowLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    healGroundShadowCircleAbove3dTerrain(mapSlot, layerId);
  }
  for (const layerId of sharedPointBadgeCircleLayerIds(pointLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    healCircleLayerAbove3dExtrusions(mapSlot, layerId);
  }
  for (const layerId of sharedPointVenueSymbolLayerIds(pointLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    healSymbolLayerAbove3dExtrusions(mapSlot, layerId);
  }
}

/** Undo 3D depth heal when terrain and buildings are off — keeps floating-badge perspective shadow. */
export function revertSharedPointLayersFrom3dExtrusions(
  map: MapInstance,
  ids: Pick<SharedPointLayerIds, 'glowLayerId' | 'pointLayerId'>,
): void {
  const mapSlot = map as MapWithStyleSlots;
  const { pointLayerId, glowLayerId } = ids;
  for (const layerId of sharedPointGroundShadowCircleLayerIds(pointLayerId, glowLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    revertGroundShadowCircleFrom3dExtrusions(mapSlot, layerId);
  }
  for (const layerId of sharedPointBadgeCircleLayerIds(pointLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    revertBadgeCircleFrom3dExtrusions(mapSlot, layerId);
  }
  for (const layerId of sharedPointVenueSymbolLayerIds(pointLayerId)) {
    if (!mapSlot.getLayer?.(layerId)) continue;
    revertSymbolLayerFrom3dExtrusions(mapSlot, layerId);
  }
}

/** Apply 3D heal only while terrain or 3D buildings are active. */
export function syncSharedPointLayersFor3dSurface(
  map: MapInstance,
  ids: Pick<SharedPointLayerIds, 'glowLayerId' | 'pointLayerId'>,
): void {
  if (isSharedPoint3dSurfaceActive(map)) {
    applySharedPointLayersAbove3dExtrusions(map, ids);
    return;
  }
  revertSharedPointLayersFrom3dExtrusions(map, ids);
}

/** @deprecated Use {@link applySharedPointLayersAbove3dExtrusions}. */
export function applySharedPointMarkerPitchAboveExtrusions(
  map: MapInstance,
  pointLayerId: string,
  glowLayerId = `${pointLayerId.replace(/-point$/, '')}-glow`,
): void {
  applySharedPointLayersAbove3dExtrusions(map, { glowLayerId, pointLayerId });
}