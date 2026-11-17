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

/** Hide selection-source chrome — select only darkens the resting marker's ground cast. */
export function hideFloatingBadgeCircleSelectionLayers(
  map: MapInstance,
  pointLayerId: string
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