import type { MapMaxBounds } from './map-max-bounds-core';
import {
  GK_MAP_DEFAULT_MIN_ZOOM,
  minZoomForMapMaxBounds,
  type ApplyH3GeoScopeMaxBoundsOptions,
  type H3MaxBoundsMap,
} from './apply-h3-map-bounds-shared';

export function applyH3MapMaxBoundsToMap(
  map: H3MaxBoundsMap | null | undefined,
  cell: string | null | undefined,
  boundsForCell: (trimmedCell: string) => MapMaxBounds,
  options: ApplyH3GeoScopeMaxBoundsOptions = {},
): void {
  const defaultMinZoom = options.defaultMinZoom ?? GK_MAP_DEFAULT_MIN_ZOOM;
  if (!map || typeof map.setMaxBounds !== 'function') return;
  const trimmed = cell?.trim();
  if (!trimmed) {
    map.setMaxBounds(null);
    if (typeof map.setMinZoom === 'function') {
      map.setMinZoom(defaultMinZoom);
    }
    return;
  }
  const bounds = boundsForCell(trimmed);
  map.setMaxBounds(bounds);
  const minZoom = minZoomForMapMaxBounds(map, bounds, defaultMinZoom);
  if (minZoom != null && typeof map.setMinZoom === 'function') {
    map.setMinZoom(minZoom);
  }
}