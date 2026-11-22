import { expandH3CellId } from '../cell/cell-id';
import { h3GetResolution, h3ToCoordinates, validateH3 } from '../geometry/core';
import { H3_RESOLUTION_FROM_ZOOM_FACTOR } from '../geometry/resolution-from-zoom';

export type H3CellMapView = {
  lat: number;
  lng: number;
  zoom: number;
  resolution: number;
};

/** Map camera anchored to an H3 cell (zoom follows the geokit resolution curve). */
export function h3CellToMapView(h3Cell: string): H3CellMapView {
  const trimmed = h3Cell.trim();
  const expanded = expandH3CellId(trimmed);
  if (!trimmed || !validateH3(expanded)) {
    throw new Error(`invalid h3 cell: ${h3Cell}`);
  }

  const resolution = h3GetResolution(expanded);
  const [lat, lng] = h3ToCoordinates(expanded);
  const zoom = resolution / H3_RESOLUTION_FROM_ZOOM_FACTOR;

  return { lat, lng, zoom, resolution };
}