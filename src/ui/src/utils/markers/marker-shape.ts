import type { MapInstance } from '../../providers/types';

/** GeoJSON property for per-feature marker body shape (shared point layers). */
export const SHARED_POINT_MARKER_SHAPE_PROPERTY = '_markerShape' as const;

export const MARKER_BODY_SHAPES = ['circle', 'rounded-rect'] as const;
export type MarkerBodyShape = (typeof MARKER_BODY_SHAPES)[number];

export function isMarkerBodyShape(value: string): value is MarkerBodyShape {
  return (MARKER_BODY_SHAPES as readonly string[]).includes(value);
}

export function markerBodyShapeFromProperties(
  properties: Record<string, unknown> | null | undefined
): MarkerBodyShape {
  const raw =
    properties && typeof properties === 'object'
      ? String(properties[SHARED_POINT_MARKER_SHAPE_PROPERTY] ?? '').trim()
      : '';
  if (isMarkerBodyShape(raw)) return raw;
  return 'circle';
}

function markerShapeMatchExpression(shape: MarkerBodyShape): unknown[] {
  return ['==', ['coalesce', ['get', SHARED_POINT_MARKER_SHAPE_PROPERTY], 'circle'], shape];
}

/** Circle stack layers — skip features painted by the rounded-rect body symbol. */
export function sharedPointCircleBodyFilter(): unknown[] {
  return ['!', markerShapeMatchExpression('rounded-rect')];
}

/** Rounded-rect body symbol layer — only features with `_markerShape: rounded-rect`. */
export function sharedPointRoundedRectBodyFilter(): unknown[] {
  return markerShapeMatchExpression('rounded-rect');
}

export function sharedPointCombineLayerFilters(
  ...filters: Array<unknown[] | null | undefined>
): unknown[] | null {
  const parts = filters.filter((f): f is unknown[] => Array.isArray(f) && f.length > 0);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return ['all', ...parts];
}

/** Circle badge body layers only — glass (zoomed-out glow) and shadow stay shape-agnostic. */
export function sharedPointCircleBodyLayerIds(pointLayerId: string): string[] {
  const suffixes = [
    '',
    '-outer-stroke',
    '-hover',
    '-hover-badge',
    '-hover-badge-outer',
  ] as const;
  return suffixes.map((suffix) => `${pointLayerId}${suffix}`);
}

/** Selected badge layers that lift together — both shapes, then the glyph. */
export function sharedPointSelectionLiftLayerIds(pointLayerId: string): string[] {
  const suffixes = [
    '-selection-badge-outer',
    '-selection-badge',
    '-selection-rounded-outer',
    '-selection-rounded-ring',
    '-selection-rounded-body',
    '-selection-badge-icon',
  ] as const;
  return suffixes.map((suffix) => `${pointLayerId}${suffix}`);
}

/** Selected marker draw order, bottom to top — always above every resting marker. */
export function sharedPointSelectionFrontLayerIds(pointLayerId: string): string[] {
  return [
    `${pointLayerId}-selection-shadow`,
    `${pointLayerId}-selection-rounded-shadow`,
    ...sharedPointSelectionLiftLayerIds(pointLayerId),
  ];
}

/** @deprecated Use {@link sharedPointCircleBodyLayerIds} — glow is not circle-scoped. */
export function sharedPointCircleStackLayerIds(
  pointLayerId: string,
  _glowLayerId?: string
): string[] {
  return sharedPointCircleBodyLayerIds(pointLayerId);
}

export function sharedPointGroundShadowLayerIds(glowLayerId: string): string[] {
  return [glowLayerId, `${glowLayerId}-hover`];
}

/** Best-effort layer filter update when the layer exists (style swaps may fail). */
export function trySetLayerFilter(
  map: MapInstance,
  layerId: string,
  filter: unknown[] | null
): void {
  if (!map.getLayer?.(layerId) || !map.setFilter) return;
  try {
    map.setFilter(layerId, filter);
  } catch {
    /* style swap */
  }
}